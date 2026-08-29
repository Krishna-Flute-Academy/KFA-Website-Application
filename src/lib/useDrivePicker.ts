'use client';

import { useState, useEffect, useRef } from 'react';

declare global {
    interface Window {
        gapi: any;
        google: any;
    }
}

export interface PickerCallbackDoc {
    id: string;
    name: string;
    mimeType: string;
    url: string;
    sizeBytes: number;
    description?: string;
    embedUrl?: string;
    iconUrl?: string;
    [key: string]: any;
}

export interface PickerCallbackData {
    action: 'picked' | 'cancel' | string;
    docs?: PickerCallbackDoc[];
    [key: string]: any;
}

export interface DrivePickerConfig {
    clientId: string;
    developerKey: string;
    viewId?: 'DOCS' | 'DOCS_IMAGES' | 'DOCS_VIDEOS' | 'DOCUMENTS' | 'SPREADSHEETS' | 'FORMS' | 'PRESENTATIONS' | 'PDFS' | string;
    token?: string;
    showUploadView?: boolean;
    showUploadFolders?: boolean;
    setIncludeFolders?: boolean;
    setSelectFolderEnabled?: boolean;
    disableDefaultView?: boolean;
    multiselect?: boolean;
    customViews?: any[];
    customScopes?: string[];
    locale?: string;
    appId?: string;
    supportDrives?: boolean;
    callbackFunction: (data: PickerCallbackData) => void;
    [key: string]: any;
}

function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (typeof document === 'undefined') return resolve();
        if (document.querySelector(`script[src="${src}"]`)) {
            return resolve();
        }
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = (err) => reject(err);
        document.body.appendChild(script);
    });
}

export default function useDrivePicker(): [(config: DrivePickerConfig) => void, boolean] {
    const [isLoading, setIsLoading] = useState(false);
    const scriptsReady = useRef(false);
    const pickerApiReady = useRef(false);

    // Pre-load Google scripts on mount so they are ready when user clicks
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const preload = async () => {
            try {
                await Promise.all([
                    loadScript('https://apis.google.com/js/api.js'),
                    loadScript('https://accounts.google.com/gsi/client'),
                ]);
                scriptsReady.current = true;

                // Pre-load the picker API
                if (window.gapi && !pickerApiReady.current) {
                    window.gapi.load('picker', () => {
                        pickerApiReady.current = true;
                    });
                }
            } catch (err) {
                console.error('Failed to preload Google scripts:', err);
            }
        };

        preload();
    }, []);

    // This function runs SYNCHRONOUSLY from the click handler
    // so the popup will not be blocked by Chrome
    const openPicker = (config: DrivePickerConfig) => {
        if (!scriptsReady.current || !window.google?.accounts?.oauth2) {
            console.warn('Google Drive Picker: Scripts not loaded yet. Please try again.');
            return;
        }

        if (!config.clientId || !config.developerKey) {
            console.warn('Google Drive Picker: Missing clientId or developerKey.');
            return;
        }

        setIsLoading(true);

        const createAndShowPicker = (oauthToken: string) => {
            if (!window.google?.picker) {
                console.error('Google Picker API not available.');
                setIsLoading(false);
                return;
            }

            const googlePicker = window.google.picker;
            const viewIdEnum = googlePicker.ViewId[config.viewId || 'DOCS'] || googlePicker.ViewId.DOCS;
            const view = new googlePicker.DocsView(viewIdEnum);

            if (config.showUploadFolders || config.setIncludeFolders) {
                view.setIncludeFolders(true);
            }
            if (config.setSelectFolderEnabled) {
                view.setSelectFolderEnabled(true);
            }
            if (config.supportDrives) {
                view.setEnableDrives(true);
            }

            const pickerBuilder = new googlePicker.PickerBuilder()
                .addView(view)
                .setOAuthToken(oauthToken)
                .setDeveloperKey(config.developerKey)
                .setCallback((data: any) => {
                    config.callbackFunction(data);
                    setIsLoading(false);
                });

            if (config.showUploadView) {
                pickerBuilder.addView(new googlePicker.DocsUploadView());
            }
            if (config.locale) {
                pickerBuilder.setLocale(config.locale);
            }
            if (config.appId) {
                pickerBuilder.setAppId(config.appId);
            }
            if (config.multiselect) {
                pickerBuilder.enableFeature(googlePicker.Feature.MULTISELECT_ENABLED);
            }
            if (config.supportDrives) {
                pickerBuilder.enableFeature(googlePicker.Feature.SUPPORT_DRIVES);
            }

            const picker = pickerBuilder.build();
            picker.setVisible(true);
        };

        if (config.token) {
            createAndShowPicker(config.token);
        } else {
            const scopes = (config.customScopes && config.customScopes.length > 0)
                ? config.customScopes.join(' ')
                : 'https://www.googleapis.com/auth/drive.file';

            // This MUST be called synchronously from the click handler
            // to avoid Chrome popup blocker
            const tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: config.clientId,
                scope: scopes,
                callback: (tokenResponse: any) => {
                    if (tokenResponse?.error) {
                        console.error('Google OAuth token error:', tokenResponse.error);
                        setIsLoading(false);
                        return;
                    }
                    if (tokenResponse?.access_token) {
                        createAndShowPicker(tokenResponse.access_token);
                    }
                },
            });

            // requestAccessToken opens the popup — must happen synchronously
            tokenClient.requestAccessToken({ prompt: '' });
        }
    };

    return [openPicker, isLoading];
}

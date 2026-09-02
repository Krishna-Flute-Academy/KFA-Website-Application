'use client';

import { useState } from 'react';

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
    const [openPickerCallback, setOpenPickerCallback] = useState<boolean>(false);

    const openPicker = async (config: DrivePickerConfig) => {
        try {
            setOpenPickerCallback(true);

            // Load Google API and GIS scripts in parallel
            await Promise.all([
                loadScript('https://apis.google.com/js/api.js'),
                loadScript('https://accounts.google.com/gsi/client'),
            ]);

            // Ensure gapi.picker is loaded
            await new Promise<void>((resolve) => {
                if (window.gapi?.picker) {
                    resolve();
                } else if (window.gapi) {
                    window.gapi.load('picker', () => resolve());
                } else {
                    resolve();
                }
            });

            const createAndShowPicker = (oauthToken: string) => {
                if (!window.google?.picker) {
                    console.error('Google Picker API not available.');
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
                if (config.disableDefaultView) {
                    pickerBuilder.disableFeature(googlePicker.Feature.NAV_HIDDEN);
                }

                const picker = pickerBuilder.build();
                picker.setVisible(true);
            };

            if (config.token) {
                createAndShowPicker(config.token);
            } else if (window.google?.accounts?.oauth2 && config.clientId) {
                const scopes = (config.customScopes && config.customScopes.length > 0)
                    ? config.customScopes.join(' ')
                    : 'https://www.googleapis.com/auth/drive.file';

                const tokenClient = window.google.accounts.oauth2.initTokenClient({
                    client_id: config.clientId,
                    scope: scopes,
                    callback: (tokenResponse: any) => {
                        if (tokenResponse?.error) {
                            console.error('Google OAuth token error:', tokenResponse.error);
                            return;
                        }
                        if (tokenResponse?.access_token) {
                            createAndShowPicker(tokenResponse.access_token);
                        }
                    },
                });

                tokenClient.requestAccessToken({ prompt: '' });
            } else {
                console.warn('Google Drive Picker: Missing token or clientId.');
            }
        } catch (error) {
            console.error('Error opening Google Drive Picker:', error);
        } finally {
            setOpenPickerCallback(false);
        }
    };

    return [openPicker, openPickerCallback];
}

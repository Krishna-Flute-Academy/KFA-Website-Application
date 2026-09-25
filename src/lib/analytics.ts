/**
 * Lightweight analytics event tracker for KFA Practice Tools and Public Pages.
 * Works seamlessly with Google Analytics (gtag), Google Tag Manager (dataLayer),
 * or standard console logging in development without external dependencies.
 */

type PracticeToolEvent =
    | 'practice_tools_view'
    | 'tool_open'
    | 'free_tool_open'
    | 'student_tool_interest'
    | 'student_tool_login_click'
    | 'student_tool_course_click'
    | 'student_tool_enquiry_click'
    | 'tuner_open'
    | 'metronome_open'
    | 'tanpura_open'
    | 'drums_open'
    | 'sur_to_notation_open'
    | 'tool_to_course_click'
    | 'tool_to_enquiry_click';

export function trackToolEvent(eventName: PracticeToolEvent, properties?: Record<string, any>) {
    try {
        if (typeof window === 'undefined') return;

        // Google Tag Manager / dataLayer support
        if (Array.isArray((window as any).dataLayer)) {
            (window as any).dataLayer.push({
                event: eventName,
                ...properties,
                timestamp: new Date().toISOString()
            });
        }

        // Google Analytics (gtag.js) support
        if (typeof (window as any).gtag === 'function') {
            (window as any).gtag('event', eventName, properties);
        }

        // Development diagnostic logging
        if (process.env.NODE_ENV === 'development') {
            console.log(`[Analytics Event] ${eventName}:`, properties);
        }
    } catch {
        // Silently swallow analytics errors to never disrupt user experience
    }
}

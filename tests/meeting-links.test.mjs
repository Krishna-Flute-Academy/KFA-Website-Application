import test from 'node:test';
import assert from 'node:assert/strict';
import createJiti from 'jiti';

const jiti = createJiti(import.meta.url);
const {
    isValidMeetingUrl,
    identifyMeetingPlatform,
    extractClassroomMetadata,
    serializeClassroomDescription,
    resolveClassroomMeetingInfo
} = jiti('../src/lib/meeting-utils.ts');

test('Meeting Utils: URL validation and platform identification', () => {
    // Valid Google Meet
    assert.equal(isValidMeetingUrl('https://meet.google.com/abc-defg-hij'), true);
    assert.equal(identifyMeetingPlatform('https://meet.google.com/abc-defg-hij'), 'Google Meet');

    // Valid Zoom
    assert.equal(isValidMeetingUrl('https://us02web.zoom.us/j/1234567890?pwd=xyz'), true);
    assert.equal(identifyMeetingPlatform('https://us02web.zoom.us/j/1234567890?pwd=xyz'), 'Zoom');

    // Valid MS Teams
    assert.equal(isValidMeetingUrl('https://teams.microsoft.com/l/meetup-join/19%3ameeting'), true);
    assert.equal(identifyMeetingPlatform('https://teams.microsoft.com/l/meetup-join/19%3ameeting'), 'Microsoft Teams');

    // Cisco Webex
    assert.equal(isValidMeetingUrl('https://company.webex.com/meet/krishna'), true);
    assert.equal(identifyMeetingPlatform('https://company.webex.com/meet/krishna'), 'Cisco Webex');

    // Generic Video URL
    assert.equal(isValidMeetingUrl('https://video.krishnaflute.com/room-123'), true);
    assert.equal(identifyMeetingPlatform('https://video.krishnaflute.com/room-123'), 'Online Video Call');

    // Invalid URLs
    assert.equal(isValidMeetingUrl(''), false);
    assert.equal(isValidMeetingUrl('not-a-url'), false);
    assert.equal(isValidMeetingUrl('javascript:alert(1)'), false);
    assert.equal(identifyMeetingPlatform(''), 'Online Meeting');
});

test('Meeting Utils: Metadata extraction and description serialization', () => {
    // Round trip with delivery format and meeting link
    const originalDesc = 'Intermediate Raag Yaman batch. Practice recordings required weekly.';
    const format = 'online';
    const link = 'https://meet.google.com/kfa-live-room';

    const serialized = serializeClassroomDescription(originalDesc, format, link);
    assert.ok(serialized.includes('[delivery_format:online]'));
    assert.ok(serialized.includes(`[meeting_link:${link}]`));
    assert.ok(serialized.includes(originalDesc));

    const extracted = extractClassroomMetadata(serialized);
    assert.equal(extracted.cleanDescription, originalDesc);
    assert.equal(extracted.deliveryFormat, 'online');
    assert.equal(extracted.reusableMeetingLink, link);

    // Serialization with empty link clears the meeting_link tag
    const serializedNoLink = serializeClassroomDescription(serialized, 'offline', '');
    assert.ok(serializedNoLink.includes('[delivery_format:offline]'));
    assert.equal(serializedNoLink.includes('[meeting_link:'), false);

    const extractedNoLink = extractClassroomMetadata(serializedNoLink);
    assert.equal(extractedNoLink.cleanDescription, originalDesc);
    assert.equal(extractedNoLink.deliveryFormat, 'offline');
    assert.equal(extractedNoLink.reusableMeetingLink, null);
});

test('Meeting Utils: Precedence resolution between session-specific and reusable links', () => {
    const reusableLink = 'https://meet.google.com/reusable-room';
    const sessionOverrideLink = 'https://zoom.us/j/special-override-room';

    // 1. Classroom with both: session-specific live_meeting_link takes precedence
    const roomWithBoth = {
        name: 'Advanced Flute',
        description: `Deep dive into ragas [delivery_format:online] [meeting_link:${reusableLink}]`,
        live_meeting_link: sessionOverrideLink
    };

    const resBoth = resolveClassroomMeetingInfo(roomWithBoth);
    assert.equal(resBoth.effectiveMeetingLink, sessionOverrideLink, 'Session-specific override takes precedence');
    assert.equal(resBoth.sessionMeetingLink, sessionOverrideLink);
    assert.equal(resBoth.reusableMeetingLink, reusableLink);
    assert.equal(resBoth.platform, 'Zoom');
    assert.equal(resBoth.isOnline, true);

    // 2. Classroom with reusable link only (no active session override)
    const roomReusableOnly = {
        name: 'Advanced Flute',
        description: `Deep dive into ragas [delivery_format:online] [meeting_link:${reusableLink}]`,
        live_meeting_link: null
    };

    const resReusable = resolveClassroomMeetingInfo(roomReusableOnly);
    assert.equal(resReusable.effectiveMeetingLink, reusableLink, 'Falls back to reusable meeting link');
    assert.equal(resReusable.sessionMeetingLink, null);
    assert.equal(resReusable.reusableMeetingLink, reusableLink);
    assert.equal(resReusable.platform, 'Google Meet');
    assert.equal(resReusable.isOnline, true);

    // 3. Offline classroom without meeting link
    const roomOffline = {
        name: 'In-person Weekend Gurukul',
        description: 'Physical studio sessions [delivery_format:offline]',
        live_meeting_link: null
    };

    const resOffline = resolveClassroomMeetingInfo(roomOffline);
    assert.equal(resOffline.effectiveMeetingLink, null);
    assert.equal(resOffline.isOnline, false);
    assert.equal(resOffline.deliveryFormat, 'offline');
});

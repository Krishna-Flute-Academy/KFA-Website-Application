import React from 'react';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-50 py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        <h1 className="text-3xl font-bold text-slate-900 mb-6">Privacy Policy</h1>
        <p className="text-sm text-slate-500 mb-8">Last updated: {new Date().toLocaleDateString()}</p>
        
        <div className="space-y-6 text-slate-700">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">1. Introduction</h2>
            <p>Welcome to Krishna Flute Academy. We respect your privacy and are committed to protecting your personal data.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">2. Google Drive Integration</h2>
            <p>Our application uses Google Drive API to allow students to easily upload and submit practice recordings.</p>
            <ul className="list-disc pl-5 mt-2 space-y-2">
              <li><strong>What we access:</strong> We only request access to the specific files you choose to upload/select via the Google Drive Picker.</li>
              <li><strong>How we use it:</strong> The selected file links are attached to your assignment submission so your instructor can review your practice.</li>
              <li><strong>What we store:</strong> We only store the URL link to your video in our secure database. We do NOT download, store, or share your actual video files.</li>
              <li><strong>Data Sharing:</strong> We do not share your Google Drive data or any other personal information with third parties.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">3. Contact Us</h2>
            <p>If you have any questions about this Privacy Policy, please contact the academy administration.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

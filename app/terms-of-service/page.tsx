import React from 'react';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-slate-50 py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        <h1 className="text-3xl font-bold text-slate-900 mb-6">Terms of Service</h1>
        <p className="text-sm text-slate-500 mb-8">Last updated: {new Date().toLocaleDateString()}</p>
        
        <div className="space-y-6 text-slate-700">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">1. Acceptance of Terms</h2>
            <p>By accessing and using the Krishna Flute Academy platform, you accept and agree to be bound by the terms and provision of this agreement.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">2. Student Submissions</h2>
            <p>Students are responsible for the content they submit via Google Drive or our audio recording feature. You agree to only submit files related to your musical coursework.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">3. Use of Google Services</h2>
            <p>Our platform integrates with Google Drive to facilitate video submissions. Your use of the Google Drive Picker is also subject to Google's Terms of Service.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

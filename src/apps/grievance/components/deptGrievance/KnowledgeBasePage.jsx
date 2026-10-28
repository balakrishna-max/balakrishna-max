import React from 'react';
import { BookOpen, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

export default function KnowledgeBasePage({ config, onBack }) {
  const steps = [
    'Complete Guide to Payment Processing',
    'Verify your payment method details',
    'Clear browser cache and cookies',
    'Try using a different browser or incognito mode',
    'Ensure your card has sufficient balance',
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="grv-card">
        <div className="grv-section-header">
          <h3><BookOpen size={16} /> Knowledge Base</h3>
        </div>

        <div className="grv-kb-grid">
          <div className="grv-kb-video">
            <video className="grv-video" controls>
              <source
                src={`${config.contextPath}/resources/chatboat-source/a2z-procure-updated1.mp4`}
                type="video/mp4"
              />
              Your browser does not support the video tag.
            </video>
          </div>
          <div className="grv-kb-steps">
            <h4>Try these steps:</h4>
            {steps.map((t, i) => (
              <div key={i} className="grv-step-row">
                <div className="grv-step-num">{i + 1}</div>
                <div className="grv-step-text">{t}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grv-actions">
          <button className="grv-btn grv-btn-secondary" onClick={onBack}>
            <ArrowLeft size={16} /> Back
          </button>
        </div>
      </div>
    </motion.div>
  );
}
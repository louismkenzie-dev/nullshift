import { useState } from 'react';
import { Check, Calendar, DollarSign, FileText, Settings, Zap } from 'lucide-react';

export default function App() {
  const [formData, setFormData] = useState({
    clientName: 'Acme Corporation',
    projectName: 'E-Commerce Platform Rebuild',
    projectDate: '2026-06-04',
    proposalNumber: 'NS-2026-042',
  });

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="mb-12 border-b border-border-strong pb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-primary rounded-full" />
              <h1 className="uppercase tracking-tight" style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 900 }}>
                NULLSHIFT
              </h1>
            </div>
            <div className="text-right">
              <p className="text-muted uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                Proposal
              </p>
              <p className="text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
                {formData.proposalNumber}
              </p>
            </div>
          </div>
          <div className="flex justify-between items-end">
            <div>
              <p className="text-muted mb-1" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
                WEB DEVELOPMENT & BRAND CREATION
              </p>
              <h2 className="text-foreground text-3xl uppercase tracking-tight" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                {formData.projectName}
              </h2>
            </div>
            <div className="text-right">
              <p className="text-muted text-sm">Prepared for</p>
              <p className="text-foreground">{formData.clientName}</p>
              <p className="text-muted text-sm mt-1">{formData.projectDate}</p>
            </div>
          </div>
        </header>

        {/* Project Overview */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-surface2 rounded flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <h3 className="uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800 }}>
              01 — PROJECT OVERVIEW
            </h3>
          </div>
          <div className="bg-surface border border-border rounded-lg p-6">
            <p className="text-foreground leading-relaxed mb-4">
              Nullshift will design and develop a comprehensive e-commerce platform that modernizes your digital presence,
              streamlines customer experience, and drives measurable business growth. This proposal outlines our technical
              approach, deliverables, timeline, and investment required.
            </p>
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="border border-border rounded p-4">
                <p className="text-muted text-sm uppercase tracking-wider mb-1" style={{ fontFamily: 'var(--font-mono)' }}>Duration</p>
                <p className="text-foreground">12 weeks</p>
              </div>
              <div className="border border-border rounded p-4">
                <p className="text-muted text-sm uppercase tracking-wider mb-1" style={{ fontFamily: 'var(--font-mono)' }}>Team Size</p>
                <p className="text-foreground">4 specialists</p>
              </div>
              <div className="border border-border rounded p-4">
                <p className="text-muted text-sm uppercase tracking-wider mb-1" style={{ fontFamily: 'var(--font-mono)' }}>Platform</p>
                <p className="text-foreground">Web + Mobile</p>
              </div>
            </div>
          </div>
        </section>

        {/* Scope of Work */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-surface2 rounded flex items-center justify-center">
              <Settings className="w-4 h-4 text-primary" />
            </div>
            <h3 className="uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800 }}>
              02 — SCOPE OF WORK
            </h3>
          </div>
          <div className="space-y-3">
            {[
              {
                phase: 'Discovery & Strategy',
                items: [
                  'Stakeholder interviews and requirements gathering',
                  'Competitive analysis and market research',
                  'User journey mapping and persona development',
                  'Technical architecture planning'
                ]
              },
              {
                phase: 'Design & Prototyping',
                items: [
                  'Brand identity refinement and design system',
                  'Wireframing and user flow documentation',
                  'High-fidelity UI/UX design (desktop and mobile)',
                  'Interactive prototypes and usability testing'
                ]
              },
              {
                phase: 'Development',
                items: [
                  'Custom React-based frontend with responsive design',
                  'RESTful API development and database architecture',
                  'Payment gateway integration (Stripe/PayPal)',
                  'Admin dashboard and content management system',
                  'Inventory management and order processing',
                  'Email automation and notification systems'
                ]
              },
              {
                phase: 'Testing & Launch',
                items: [
                  'Cross-browser and device compatibility testing',
                  'Performance optimization and security audit',
                  'User acceptance testing (UAT)',
                  'Deployment to production environment',
                  'Documentation and team training'
                ]
              }
            ].map((phase, index) => (
              <div key={index} className="bg-surface border border-border rounded-lg p-6">
                <h4 className="text-primary mb-3 uppercase tracking-wide" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
                  Phase {index + 1}: {phase.phase}
                </h4>
                <ul className="space-y-2">
                  {phase.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Deliverables */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-surface2 rounded flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <h3 className="uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800 }}>
              03 — DELIVERABLES
            </h3>
          </div>
          <div className="bg-surface border border-border rounded-lg p-6">
            <div className="grid grid-cols-2 gap-6">
              {[
                'Fully functional e-commerce platform',
                'Responsive mobile-optimized design',
                'Custom admin dashboard',
                'Product catalog management system',
                'Secure payment processing',
                'Order tracking and fulfillment',
                'Customer account management',
                'Email marketing integration',
                'Analytics and reporting tools',
                'SEO optimization',
                'Source code and documentation',
                '90 days post-launch support'
              ].map((deliverable, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0" />
                  <span className="text-foreground">{deliverable}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Timeline */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-surface2 rounded flex items-center justify-center">
              <Calendar className="w-4 h-4 text-primary" />
            </div>
            <h3 className="uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800 }}>
              04 — TIMELINE
            </h3>
          </div>
          <div className="bg-surface border border-border rounded-lg p-6">
            <div className="space-y-4">
              {[
                { milestone: 'Project Kickoff', week: 'Week 1', description: 'Initial discovery and planning session' },
                { milestone: 'Design Approval', week: 'Week 4', description: 'Complete UI/UX designs and prototypes' },
                { milestone: 'Development Sprint 1', week: 'Week 8', description: 'Core functionality and frontend' },
                { milestone: 'Testing & QA', week: 'Week 11', description: 'Comprehensive testing phase' },
                { milestone: 'Launch', week: 'Week 12', description: 'Production deployment and go-live' }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 pb-4 border-b border-border last:border-b-0 last:pb-0">
                  <div className="w-20 flex-shrink-0">
                    <span className="text-primary uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                      {item.week}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-foreground">{item.milestone}</p>
                    <p className="text-muted text-sm">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Investment */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-surface2 rounded flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-primary" />
            </div>
            <h3 className="uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800 }}>
              05 — INVESTMENT
            </h3>
          </div>
          <div className="bg-surface border border-border rounded-lg p-6">
            <div className="space-y-3 mb-6">
              {[
                { item: 'Discovery & Strategy', hours: '40', rate: '$150', total: '$6,000' },
                { item: 'Design & Prototyping', hours: '80', rate: '$150', total: '$12,000' },
                { item: 'Development', hours: '240', rate: '$150', total: '$36,000' },
                { item: 'Testing & QA', hours: '40', rate: '$150', total: '$6,000' },
                { item: 'Project Management', hours: '32', rate: '$150', total: '$4,800' },
                { item: 'Post-Launch Support (90 days)', hours: '—', rate: '—', total: '$3,200' }
              ].map((row, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-border">
                  <span className="text-foreground flex-1">{row.item}</span>
                  <span className="text-muted w-24 text-right" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>{row.hours} hrs</span>
                  <span className="text-muted w-24 text-right" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>{row.rate}/hr</span>
                  <span className="text-foreground w-32 text-right" style={{ fontFamily: 'var(--font-mono)' }}>{row.total}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-6 border-t-2 border-primary">
              <span className="text-foreground uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800 }}>
                Total Investment
              </span>
              <span className="text-primary text-3xl" style={{ fontFamily: 'var(--font-display)', fontWeight: 900 }}>
                $68,000
              </span>
            </div>

            {/* Payment Schedule */}
            <div className="mt-8 pt-8 border-t border-border">
              <h4 className="text-primary mb-4 uppercase tracking-wide" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
                Payment Schedule
              </h4>
              <div className="space-y-2">
                {[
                  { stage: 'Contract Signing', percentage: '30%', amount: '$20,400', timing: 'Upon contract execution' },
                  { stage: 'Design Approval', percentage: '30%', amount: '$20,400', timing: 'Week 4 milestone' },
                  { stage: 'Development Complete', percentage: '30%', amount: '$20,400', timing: 'Week 10 milestone' },
                  { stage: 'Final Launch', percentage: '10%', amount: '$6,800', timing: 'Week 12 deployment' }
                ].map((payment, i) => (
                  <div key={i} className="flex items-center justify-between bg-surface2 rounded p-3">
                    <div className="flex-1">
                      <span className="text-foreground">{payment.stage}</span>
                      <p className="text-muted text-sm">{payment.timing}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-primary" style={{ fontFamily: 'var(--font-mono)' }}>{payment.percentage}</span>
                      <p className="text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{payment.amount}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Terms */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-surface2 rounded flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <h3 className="uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800 }}>
              06 — TERMS & CONDITIONS
            </h3>
          </div>
          <div className="bg-surface border border-border rounded-lg p-6">
            <div className="space-y-4 text-foreground text-sm leading-relaxed">
              <div>
                <h4 className="text-primary mb-2 uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                  Project Scope
                </h4>
                <p className="text-muted">
                  Any modifications or additions to the outlined scope will be documented via change request and may adjust
                  timeline and budget accordingly. We commit to transparent communication throughout the process.
                </p>
              </div>
              <div>
                <h4 className="text-primary mb-2 uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                  Intellectual Property
                </h4>
                <p className="text-muted">
                  Upon final payment, all custom code, designs, and deliverables become the client's property. Nullshift
                  retains the right to showcase the project in our portfolio.
                </p>
              </div>
              <div>
                <h4 className="text-primary mb-2 uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                  Support & Maintenance
                </h4>
                <p className="text-muted">
                  90 days of post-launch support includes bug fixes and minor adjustments. Extended maintenance packages
                  available upon request.
                </p>
              </div>
              <div>
                <h4 className="text-primary mb-2 uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                  Validity
                </h4>
                <p className="text-muted">
                  This proposal is valid for 30 days from the date above. Pricing and availability subject to change thereafter.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Acceptance */}
        <section className="mb-12">
          <div className="bg-gradient-to-br from-surface via-surface to-surface2 border-2 border-primary rounded-lg p-8">
            <h3 className="text-primary uppercase tracking-wide mb-6 text-center" style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 900 }}>
              READY TO BUILD?
            </h3>
            <p className="text-center text-foreground mb-8 max-w-2xl mx-auto">
              Sign below to accept this proposal and begin your project. We'll schedule a kickoff call within 48 hours
              to align on next steps and finalize deliverables.
            </p>

            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <label className="text-muted text-sm uppercase tracking-wider mb-2 block" style={{ fontFamily: 'var(--font-mono)' }}>
                  Client Name
                </label>
                <div className="bg-surface border border-border rounded px-4 py-3">
                  <input
                    type="text"
                    className="w-full bg-transparent text-foreground outline-none"
                    placeholder="Full name"
                  />
                </div>
              </div>
              <div>
                <label className="text-muted text-sm uppercase tracking-wider mb-2 block" style={{ fontFamily: 'var(--font-mono)' }}>
                  Date
                </label>
                <div className="bg-surface border border-border rounded px-4 py-3">
                  <input
                    type="date"
                    className="w-full bg-transparent text-foreground outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="mb-8">
              <label className="text-muted text-sm uppercase tracking-wider mb-2 block" style={{ fontFamily: 'var(--font-mono)' }}>
                Signature
              </label>
              <div className="bg-surface border border-border-strong rounded h-32 flex items-center justify-center">
                <span className="text-muted italic">Click to sign</span>
              </div>
            </div>

            <button className="w-full bg-primary text-primary-foreground py-4 rounded uppercase tracking-wider hover:opacity-90 transition-opacity"
                    style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.125rem' }}>
              Accept Proposal
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border pt-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-2 h-2 bg-primary rounded-full" />
            <span className="text-muted uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
              NULLSHIFT — WEB DEVELOPMENT & BRAND CREATION
            </span>
          </div>
          <p className="text-muted text-sm">
            © 2026 NULLSHIFT — BUILT WITH INTENTION
          </p>
        </footer>
      </div>
    </div>
  );
}

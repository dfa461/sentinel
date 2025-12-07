import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  Code2,
  Brain,
  TrendingUp,
  Target,
  Zap,
  BarChart3,
  MessageSquare,
  Eye,
  Shield,
  Lightbulb,
  Activity,
  ArrowRight,
  CheckCircle,
  Users,
  Briefcase,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { CandidateInfoModal } from '../components/CandidateInfoModal';
import type { CandidateInfo } from '../components/CandidateInfoModal';

// xAI Logo SVG Component
const XAILogo = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 841.89 595.28"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="currentColor"
  >
    <g>
      <polygon points="557.09,211.99 565.4,538.36 631.96,538.36 640.28,93.18" />
      <polygon points="640.28,56.91 538.72,56.91 379.35,284.53 430.13,357.05" />
      <polygon points="201.61,538.36 303.17,538.36 353.96,465.84 303.17,393.31" />
      <polygon points="201.61,211.99 430.13,538.36 531.69,538.36 303.17,211.99" />
    </g>
  </svg>
);

export function LandingPage() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  const handleStartAssessment = () => {
    setShowModal(true);
  };

  const handleModalSubmit = (candidateInfo: CandidateInfo) => {
    // Navigate to assessment with candidate info
    navigate('/interactive', {
      state: {
        candidateInfo,
      },
    });
  };

  const features = [
    {
      icon: Brain,
      title: 'AI-Powered Monitoring',
      description: 'Real-time AI analyzes candidate behavior, code quality, and problem-solving approach',
      color: 'from-purple-500 to-pink-500',
    },
    {
      icon: MessageSquare,
      title: 'Adaptive Challenge Questions',
      description: 'AI generates relevant follow-up questions based on code progress to probe understanding',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Lightbulb,
      title: 'Smart Hints System',
      description: 'Context-aware hints when candidates are stuck, available on-demand',
      color: 'from-yellow-500 to-orange-500',
    },
    {
      icon: BarChart3,
      title: 'Advanced Analytics',
      description: 'Code complexity metrics, execution tracking, and comprehensive evaluation reports',
      color: 'from-indigo-500 to-purple-500',
    },
  ];

  const benefits = [
    {
      icon: Eye,
      title: 'For Recruiters',
      points: [
        'Filter candidates by code quality and communication',
        'AI-generated evaluation summaries',
        'Keystroke analytics reveal problem-solving patterns',
        'Custom weighted scoring system',
      ],
    },
    {
      icon: Target,
      title: 'For Candidates',
      points: [
        'Get helpful hints when genuinely stuck',
        'Learn through Socratic questioning',
        'Natural coding experience with AI assistance',
        'Resizable panels and customizable workspace',
      ],
    },
  ];


  return (
    <div className="min-h-screen bg-slate-900 overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 -left-48 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 -right-48 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-pink-500/10 rounded-full blur-3xl" />
        </div>

        {/* Grid Pattern Overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 text-center">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
            className="mb-4"
          >
            <img
              src="/sentinel-logo.png"
              alt="Sentinel Logo"
              className="w-52 h-52 md:w-72 md:h-72 lg:w-96 lg:h-96 mx-auto drop-shadow-2xl hover:scale-105 transition-transform duration-300"
            />
          </motion.div>

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-effect border border-blue-500/30 mb-6"
          >
            <XAILogo className="w-4 h-4 text-white" />
            <span className="text-sm text-slate-300">Powered by Grok AI + Reinforcement Learning</span>
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-6xl md:text-8xl font-bold mb-6 leading-tight"
          >
            <span className="text-gradient bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Sentinel
            </span>
            <br />
            <span className="text-white">AI Assessment</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl md:text-2xl text-slate-300 mb-12 max-w-3xl mx-auto leading-relaxed"
          >
            The next generation of technical assessments.{' '}
            <span className="text-blue-400 font-semibold">AI-powered candidate discovery</span> meets{' '}
            <span className="text-purple-400 font-semibold">adaptive evaluation</span> for smarter hiring decisions.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-20"
          >
            <button
              onClick={() => navigate('/results/demo')}
              className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl font-semibold text-lg transition-all shadow-2xl hover:shadow-blue-500/50 flex items-center gap-3"
            >
              <BarChart3 className="w-6 h-6" />
              View Recruiter Dashboard
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-6 h-10 border-2 border-slate-600 rounded-full flex items-start justify-center p-2"
          >
            <motion.div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
          </motion.div>
        </motion.div>
      </section>

      {/* What is Sentinel Section */}
      <section className="relative py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <h2 className="text-5xl font-bold text-white mb-6">
              What is <span className="text-gradient">Sentinel</span>?
            </h2>
            <p className="text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
              Sentinel is an AI-enhanced recruitment platform that discovers top engineering talent from X (Twitter),
              enriches profiles with GitHub data, and provides{' '}
              <span className="text-blue-400 font-semibold">adaptive coding assessments</span> with{' '}
              <span className="text-purple-400 font-semibold">intelligent challenge questions</span>.
              It monitors candidate behavior in real-time, offers smart hints, and generates comprehensive evaluation reports.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
                className="glass-effect rounded-2xl p-8 border border-slate-700 hover:border-blue-500/50 transition-all group"
              >
                <div
                  className={cn(
                    'w-14 h-14 rounded-xl bg-gradient-to-br flex items-center justify-center mb-6 group-hover:scale-110 transition-transform',
                    feature.color
                  )}
                >
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-slate-400 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="relative py-32 px-6 bg-slate-800/30">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <h2 className="text-5xl font-bold text-white mb-6">How It Works</h2>
            <p className="text-xl text-slate-300 max-w-3xl mx-auto">
              Sentinel uses advanced AI to create an interactive, adaptive assessment experience
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              {[
                {
                  step: '01',
                  title: 'Candidate Starts Assessment',
                  desc: 'Choose a problem and begin coding in a Monaco-powered editor',
                },
                {
                  step: '02',
                  title: 'AI Monitors Progress',
                  desc: 'Real-time tracking of code quality, pauses, and execution attempts',
                },
                {
                  step: '03',
                  title: 'Adaptive Interventions',
                  desc: 'AI asks follow-up questions, provides hints, and evaluates thought process',
                },
                {
                  step: '04',
                  title: 'Comprehensive Report',
                  desc: 'Recruiters get detailed analytics, AI evaluation, and candidate insights',
                },
              ].map((item, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center font-bold text-white text-lg">
                    {item.step}
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-white mb-2">{item.title}</h4>
                    <p className="text-slate-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="glass-effect rounded-2xl p-8 border border-slate-700"
            >
              <div className="space-y-6">
                <div className="flex items-center gap-3 text-green-400">
                  <CheckCircle className="w-6 h-6" />
                  <span className="font-semibold">X/Twitter Candidate Discovery</span>
                </div>
                <div className="flex items-center gap-3 text-blue-400">
                  <CheckCircle className="w-6 h-6" />
                  <span className="font-semibold">Adaptive Challenge Questions</span>
                </div>
                <div className="flex items-center gap-3 text-purple-400">
                  <CheckCircle className="w-6 h-6" />
                  <span className="font-semibold">GitHub Profile Enrichment</span>
                </div>
                <div className="flex items-center gap-3 text-pink-400">
                  <CheckCircle className="w-6 h-6" />
                  <span className="font-semibold">Context-Aware Hints</span>
                </div>
                <div className="flex items-center gap-3 text-yellow-400">
                  <CheckCircle className="w-6 h-6" />
                  <span className="font-semibold">Code Execution & Testing</span>
                </div>
                <div className="flex items-center gap-3 text-cyan-400">
                  <CheckCircle className="w-6 h-6" />
                  <span className="font-semibold">AI Evaluation Reports</span>
                </div>

                <div className="mt-8 pt-8 border-t border-slate-700">
                  <div className="flex items-center gap-3 mb-4">
                    <Shield className="w-6 h-6 text-blue-400" />
                    <span className="text-white font-semibold">Powered by Grok AI</span>
                  </div>
                  <p className="text-sm text-slate-400">
                    Using xAI's Grok API for real-time language understanding, adaptive questioning, and intelligent
                    evaluation
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="relative py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <h2 className="text-5xl font-bold text-white mb-6">Built for Everyone</h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-12">
            {benefits.map((benefit, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.2 }}
                className="glass-effect rounded-2xl p-10 border border-slate-700"
              >
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                    <benefit.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">{benefit.title}</h3>
                </div>

                <ul className="space-y-4">
                  {benefit.points.map((point, pointIdx) => (
                    <li key={pointIdx} className="flex items-start gap-3">
                      <Zap className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-300">{point}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="glass-effect rounded-3xl p-12 md:p-16 border border-blue-500/30 relative overflow-hidden"
          >
            {/* Background Glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10" />

            <div className="relative z-10 text-center">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Ready to Transform Your Hiring?
              </h2>
              <p className="text-xl text-slate-300 mb-12 max-w-2xl mx-auto">
                Experience the future of technical assessments with AI-powered insights and adaptive learning
              </p>

              <div className="flex justify-center">
                <button
                  onClick={() => navigate('/results/demo')}
                  className="group px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl font-semibold text-lg transition-all shadow-2xl hover:shadow-blue-500/50 flex items-center justify-center gap-3"
                >
                  <Briefcase className="w-6 h-6" />
                  View Recruiter Dashboard
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-12 px-6 border-t border-slate-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-xl">
                <Code2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-xl font-bold text-white">Sentinel</div>
                <div className="text-sm text-slate-400">AI-Enhanced Assessments</div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <XAILogo className="w-4 h-4 text-white" />
              <span>Built for xAI Hackathon</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Candidate Info Modal */}
      <CandidateInfoModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleModalSubmit}
      />
    </div>
  );
}

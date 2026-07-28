import React from "react";
import { motion } from "framer-motion";
import { Upload, Lightbulb, BarChart3 } from "lucide-react";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const FeaturesSection = () => {
  const features = [
    {
      icon: <Upload className="w-6 h-6" />,
      title: "Upload Resume",
      description:
        "Simply upload your resume in PDF format to get started. Our system can handle various resume layouts and formats.",
    },
    {
      icon: <Lightbulb className="w-6 h-6" />,
      title: "AI Analysis",
      description:
        "Advanced NLP techniques analyze your resume, extracting key information and matching it with company requirements.",
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Get Ranked",
      description:
        "Receive a personalized ranking of companies where your resume has the highest match score, helping you focus your job search.",
    },
  ];

  return (
    <motion.section
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true }}
      className="py-12"
    >
      <h2 className="text-3xl font-display font-bold text-center text-on-surface mb-10">
        How It Works
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {features.map((feature, index) => (
          <motion.div
            key={index}
            variants={item}
            className="card card-hover p-6"
          >
            <div
              className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-5"
            >
              {feature.icon}
            </div>

            <h3 className="text-xl font-display font-semibold text-on-surface mb-3">
              {feature.title}
            </h3>

            <p className="text-on-surface-variant">
              {feature.description}
            </p>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
};

export default FeaturesSection;


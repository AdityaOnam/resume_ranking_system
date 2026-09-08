import React from "react";
import { PiUploadSimple, PiLightbulb, PiChartBar } from "react-icons/pi";

const FeaturesSection = () => {
  const features = [
    {
      icon: <PiUploadSimple className="w-6 h-6" />,
      title: "Upload Resume",
      description:
        "Simply upload your resume in PDF format to get started. Our system can handle various resume layouts and formats.",
    },
    {
      icon: <PiLightbulb className="w-6 h-6" />,
      title: "AI Analysis",
      description:
        "Advanced NLP techniques analyze your resume, extracting key information and matching it with company requirements.",
    },
    {
      icon: <PiChartBar className="w-6 h-6" />,
      title: "Get Ranked",
      description:
        "Receive a personalized ranking of companies where your resume has the highest match score, helping you focus your job search.",
    },
  ];

  return (
    <section className="py-12 border-t border-line mt-8">
      <h2 className="text-[26px] font-display font-bold text-center text-text mb-10 tracking-[-0.02em]">
        How It Works
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {features.map((feature, index) => (
          <div
            key={index}
            className="border border-line bg-surface p-6 rounded-xl flex flex-col gap-4 transition-all duration-200 hover:border-accent hover:shadow-lg hover:-translate-y-1"
          >
            <div className="w-12 h-12 rounded-lg bg-tint text-accent flex items-center justify-center">
              {feature.icon}
            </div>

            <h3 className="text-lg font-display font-semibold text-text">
              {feature.title}
            </h3>

            <p className="text-[13.5px] leading-[1.6] text-muted">
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default FeaturesSection;

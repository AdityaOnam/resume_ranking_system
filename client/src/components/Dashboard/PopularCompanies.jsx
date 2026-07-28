import { motion } from "framer-motion";
import { ArrowRight, Building2, Briefcase, Code, Server } from "lucide-react";
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from "../ui/skeleton";
import { getCompanies } from "../../services/api";
import { Link } from "react-router-dom";

const cardHover = {
  rest: { scale: 1, transition: { duration: 0.3 } },
  hover: { scale: 1.02, transition: { duration: 0.3 } },
};

const ICON_STYLES = [
  'bg-primary/10 text-primary',
  'bg-secondary/10 text-secondary',
  'bg-error/10 text-error'
];

const PopularCompanies = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => getCompanies().then(r => r.data),
  });
  const companies = Array.isArray(data) ? data : [];

  const getCompanyIcon = (company) => {
    const name = company.name?.toLowerCase() || "";
    if (name.includes("google") || name.includes("microsoft") || name.includes("amazon")) {
      return <Code className="w-6 h-6" />;
    } else if (name.includes("bank") || name.includes("finance") || name.includes("capital")) {
      return <Building2 className="w-6 h-6" />;
    } else if (company.skill_set?.some(skill =>
      skill.toLowerCase().includes("cloud") || skill.toLowerCase().includes("aws")
    )) {
      return <Server className="w-6 h-6" />;
    } else {
      return <Briefcase className="w-6 h-6" />;
    }
  };

  const displayedCompanies = companies.slice(0, 6);

  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      viewport={{ once: true }}
      className="py-12"
    >
      <h2 className="text-3xl font-display font-bold text-center text-on-surface mb-4">
        Popular Companies
      </h2>
      <p className="text-center text-on-surface-variant mb-10 max-w-3xl mx-auto">
        Some of the top companies in our database that are actively looking for candidates
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="card p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center">
                  <Skeleton className="w-12 h-12 rounded-lg mr-4" />
                  <div>
                    <Skeleton className="h-5 w-32 mb-2" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
                <Skeleton className="h-6 w-20 rounded" />
              </div>
              <div className="mt-4 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          ))
        ) : (
          displayedCompanies.map((company, index) => (
            <motion.div
              key={company._id || company.id || index}
              initial="rest"
              whileHover="hover"
              animate="rest"
              variants={cardHover}
              className="card card-hover p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center">
                  <div
                    className={`w-12 h-12 ${ICON_STYLES[index % ICON_STYLES.length]} rounded-lg flex items-center justify-center mr-4`}
                  >
                    {getCompanyIcon(company)}
                  </div>
                  <div>
                    <h3 className="text-lg font-display font-semibold text-on-surface">
                      {company.name}
                    </h3>
                    <p className="text-sm text-on-surface-variant">
                      {company.internship_role}
                    </p>
                  </div>
                </div>
              </div>
                <div className="bg-primary/15 text-primary text-xs font-medium py-1 px-2 rounded mt-3 inline-block">
                  Visits IIT Patna: {company.visits_iit_patna ? "Yes" : "No"}
                </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-on-surface-variant">Min. CPI/GPA</span>
                  <span className="font-medium text-on-surface">
                    {company?.cpi || "Not Available"}
                  </span>
                </div>
                <div className="flex justify-between gap-10 text-sm mb-1">
                  <span className="text-on-surface-variant">Required Skills</span>
                  <span className="font-medium text-on-surface text-right">
                    {(company?.skill_set || []).slice(0, 3).join(", ") || "None"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">Branches</span>
                  <span className="font-medium text-on-surface text-right">
                    {(company?.branch || []).slice(0, 3).join(", ") || "Any"}
                  </span>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <div className="mt-10 text-center">
        <Link to="/companies">
          <button
            className="btn-ghost py-2 px-4 rounded flex items-center justify-center mx-auto"
          >
            View All Companies
            <ArrowRight className="ml-2 w-4 h-4" />
          </button>
        </Link>
      </div>
    </motion.section>
  );
};

export default PopularCompanies;

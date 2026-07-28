import React from 'react';

const SkillGapTable = ({ eligible, reasons }) => {
  if (eligible) {
    return (
      <div className="flex items-center gap-2 text-xs text-secondary px-1">
        <span className="material-symbols-outlined text-[16px]">check_circle</span>
        Meets all eligibility requirements.
      </div>
    );
  }

  const reasonList = reasons || [];
  if (reasonList.length === 0) {
    return <p className="text-xs text-on-surface-variant italic px-1">Not eligible — no reasons recorded.</p>;
  }

  return (
    <ul className="flex flex-col gap-1.5 px-1">
      {reasonList.map((reason, i) => (
        <li key={i} className="flex items-start gap-2 text-xs text-[#fb7185]">
          <span className="material-symbols-outlined text-[14px] mt-0.5">cancel</span>
          {reason}
        </li>
      ))}
    </ul>
  );
};

export default SkillGapTable;

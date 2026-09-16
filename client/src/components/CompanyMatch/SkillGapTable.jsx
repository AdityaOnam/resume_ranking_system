import React from 'react';
import { PiCheckCircle, PiXCircle } from 'react-icons/pi';

const SkillGapTable = ({ eligible, reasons }) => {
  if (eligible) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-success px-1">
        <PiCheckCircle size={16} weight="fill" />
        Meets all eligibility requirements.
      </div>
    );
  }

  const reasonList = reasons || [];
  if (reasonList.length === 0) {
    return <p className="text-[13px] text-muted italic px-1 m-0">Not eligible — no reasons recorded.</p>;
  }

  return (
    <ul className="flex flex-col gap-1.5 px-1 m-0 p-0 list-none">
      {reasonList.map((reason, i) => (
        <li key={i} className="flex items-start gap-2 text-[13px] text-error">
          <PiXCircle size={16} className="mt-[3px] shrink-0" weight="fill" />
          {reason}
        </li>
      ))}
    </ul>
  );
};

export default SkillGapTable;

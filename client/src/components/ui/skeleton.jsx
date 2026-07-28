// src/components/ui/skeleton.jsx
import React from 'react';

export const Skeleton = ({ className, variant = "rounded", ...props }) => {
  const variantClasses = {
    rounded: "rounded-md",
    sharp: "",
    circular: "rounded-full"
  };
  
  return (
    <div 
      className={`animate-pulse bg-surface-variant ${variantClasses[variant]} ${className}`} 
      {...props} 
    />
  );
};

import React from 'react';

export default function BruinLMLogo({ textSize = 36 }) {
  return (
    <span style={{
      fontWeight: 700,
      fontSize: textSize,
      letterSpacing: '-0.02em',
      fontFamily: 'inherit',
      background: 'linear-gradient(90deg, #4F8AC9 0%, #7c9e6e 60%, #e6c84a 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      color: 'transparent',
      display: 'inline-block',
    }}>
      BruinLM
    </span>
  );
}

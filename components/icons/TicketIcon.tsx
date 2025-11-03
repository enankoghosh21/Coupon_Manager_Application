import React from 'react';

export const TicketIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg 
        {...props}
        xmlns="http://www.w3.org/2000/svg" 
        fill="none" 
        viewBox="0 0 24 24" 
        strokeWidth={1.5} 
        stroke="currentColor"
    >
        <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-1.5h5.25m-5.25 0h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.5a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm18-13.5a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm-1.5 7.5a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Z" 
        />
    </svg>
);

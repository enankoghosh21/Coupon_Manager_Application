import React from 'react';

export const DashboardIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
            d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h12A2.25 2.25 0 0 0 20.25 14.25V3m-16.5 0h16.5m-16.5 0h3.75m-3.75 0h16.5M3.75 16.5h16.5m-16.5 0a1.125 1.125 0 0 1-1.125-1.125v-1.5c0-.621.504-1.125 1.125-1.125H3.75m16.5 0a1.125 1.125 0 0 0 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-1.5m-1.5 3.75a1.125 1.125 0 0 1-1.125-1.125v-6.75a1.125 1.125 0 0 1 1.125-1.125h1.5a1.125 1.125 0 0 1 1.125 1.125v6.75a1.125 1.125 0 0 1-1.125 1.125h-1.5Zm-7.5-3.75a1.125 1.125 0 0 1-1.125-1.125v-4.5a1.125 1.125 0 0 1 1.125-1.125h1.5a1.125 1.125 0 0 1 1.125 1.125v4.5a1.125 1.125 0 0 1-1.125 1.125h-1.5Z" 
        />
    </svg>
);
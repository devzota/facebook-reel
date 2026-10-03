import React, { useState, useRef, useEffect } from 'react';

export interface DropdownOption {
  value: string | number;
  label: string | React.ReactNode;
}

interface CustomDropdownProps {
  value: string | number;
  onChange: (value: any) => void;
  options: DropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function CustomDropdown({ value, onChange, options, placeholder, disabled, className }: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => String(opt.value) === String(value));

  return (
    <div className={`relative ${className || ''}`} ref={dropdownRef}>
      <div 
        className={`w-full bg-fb-surface border ${isOpen ? 'border-fb-blue ring-1 ring-fb-blue/50' : 'border-fb-surface-hover/80'} rounded-lg px-3 py-1.5 min-h-[32px] text-xs flex justify-between items-center cursor-pointer transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-fb-blue/50'}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={selectedOption ? 'text-fb-text truncate' : 'text-fb-text-muted font-medium truncate'}>
          {selectedOption ? selectedOption.label : (placeholder || 'Chọn...')}
        </span>
        <span className="material-symbols-outlined text-[16px] text-fb-text-muted transition-transform duration-200 shrink-0 ml-2" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)' }}>
          expand_more
        </span>
      </div>
      
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-fb-surface border border-fb-surface-hover/80 rounded-lg shadow-xl shadow-black/10 max-h-60 overflow-y-auto custom-scrollbar py-1 animate-in fade-in zoom-in-95 duration-100">
          {options.length === 0 && (
            <div className="px-3 py-2 text-[11px] text-fb-text-muted italic text-center">Không có dữ liệu</div>
          )}
          {options.map((opt, i) => {
            const isSelected = String(opt.value) === String(value);
            return (
              <div 
                key={i} 
                className={`px-3 py-2 text-[11px] cursor-pointer flex justify-between items-center transition-colors ${isSelected ? 'bg-fb-blue/10 text-fb-blue font-bold' : 'text-fb-text hover:bg-fb-surface-hover'}`}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
              >
                <span className="truncate pr-2">{opt.label}</span>
                {isSelected && <span className="material-symbols-outlined text-[14px]">check</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

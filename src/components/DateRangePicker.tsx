'use client';

import { useState, useRef, useEffect } from 'react';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  tripType: 'roundtrip' | 'oneway';
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

export default function DateRangePicker({
  startDate,
  endDate,
  tripType,
  onStartDateChange,
  onEndDateChange
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectingStart, setSelectingStart] = useState(true);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const parseDate = (dateString: string) => {
    return dateString ? new Date(dateString) : null;
  };

  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const getNextMonth = () => {
    const nextMonth = new Date(currentMonth);
    nextMonth.setMonth(currentMonth.getMonth() + 1);
    return nextMonth;
  };

  const isDateInRange = (date: Date) => {
    if (!startDate || !endDate) return false;
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    if (!start || !end) return false;
    
    return date >= start && date <= end;
  };

  const isDateHovered = (date: Date) => {
    if (!hoveredDate || !startDate || endDate) return false;
    const start = parseDate(startDate);
    if (!start) return false;

    const minDate = start < hoveredDate ? start : hoveredDate;
    const maxDate = start > hoveredDate ? start : hoveredDate;
    
    return date >= minDate && date <= maxDate;
  };

  const isDateSelected = (date: Date) => {
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    
    if (start && date.getTime() === start.getTime()) return true;
    if (end && date.getTime() === end.getTime()) return true;
    
    return false;
  };

  const isDateDisabled = (date: Date) => {
    return date < today;
  };

  const handleDateClick = (date: Date) => {
    if (isDateDisabled(date)) return;

    if (tripType === 'oneway') {
      onStartDateChange(formatDate(date));
      setIsOpen(false);
      return;
    }

    // Round trip logic
    if (selectingStart || !startDate) {
      onStartDateChange(formatDate(date));
      onEndDateChange('');
      setSelectingStart(false);
    } else {
      const start = parseDate(startDate);
      if (start && date <= start) {
        // If end date is before or same as start, swap them
        onStartDateChange(formatDate(date));
        onEndDateChange(startDate);
      } else {
        onEndDateChange(formatDate(date));
      }
      setSelectingStart(true);
      setIsOpen(false);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(prev.getMonth() - 1);
      } else {
        newMonth.setMonth(prev.getMonth() + 1);
      }
      return newMonth;
    });
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="position-relative" ref={containerRef}>
      <div className="row g-2">
        <div className={tripType === 'roundtrip' ? 'col-6' : 'col-12'}>
          <label className="form-label">
            <i className="bi bi-calendar-event me-2"></i>
            Departure Date
            <span className="text-danger ms-1">*</span>
          </label>
          <div
            className={`form-control date-picker-input ${isOpen && selectingStart ? 'active' : ''}`}
            onClick={() => {
              setIsOpen(true);
              setSelectingStart(true);
            }}
            style={{ cursor: 'pointer' }}
          >
            {startDate ? formatDisplayDate(startDate) : 'Select departure date'}
            <i className="bi bi-calendar3 ms-auto"></i>
          </div>
        </div>
        
        {tripType === 'roundtrip' && (
          <div className="col-6">
            <label className="form-label">
              <i className="bi bi-calendar-check me-2"></i>
              Return Date
              <span className="text-danger ms-1">*</span>
            </label>
            <div
              className={`form-control date-picker-input ${isOpen && !selectingStart ? 'active' : ''} ${!startDate ? 'disabled' : ''}`}
              onClick={() => {
                if (startDate) {
                  setIsOpen(true);
                  setSelectingStart(false);
                }
              }}
              style={{ cursor: startDate ? 'pointer' : 'not-allowed' }}
            >
              {endDate ? formatDisplayDate(endDate) : 'Select return date'}
              <i className="bi bi-calendar3 ms-auto"></i>
            </div>
          </div>
        )}
      </div>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-25"
            style={{ zIndex: 9998 }}
            onClick={() => setIsOpen(false)}
          ></div>
          
          {/* Date Picker Modal */}
          <div 
            className="date-picker-dropdown position-fixed bg-light-cream border rounded-3 shadow-lg p-4" 
            style={{ 
              zIndex: 9999, 
              minWidth: tripType === 'roundtrip' ? '680px' : '400px',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            {/* Close Button */}
            <button
              type="button"
              className="btn-close position-absolute top-0 end-0 m-3"
              onClick={() => setIsOpen(false)}
              aria-label="Close"
            ></button>

            {/* Calendar Header */}
            <div className="d-flex justify-content-between align-items-center mb-4 pe-4">
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={() => navigateMonth('prev')}
              >
                <i className="bi bi-chevron-left"></i>
              </button>
              <div className="d-flex gap-4">
                <h6 className="mb-0 fw-bold text-jet-black">
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </h6>
                {tripType === 'roundtrip' && (
                  <h6 className="mb-0 fw-bold text-jet-black">
                    {monthNames[(currentMonth.getMonth() + 1) % 12]} {currentMonth.getMonth() === 11 ? currentMonth.getFullYear() + 1 : currentMonth.getFullYear()}
                  </h6>
                )}
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={() => navigateMonth('next')}
              >
                <i className="bi bi-chevron-right"></i>
              </button>
            </div>

            {/* Calendar Content */}
            <div className={`d-flex ${tripType === 'roundtrip' ? 'gap-4' : 'justify-content-center'}`}>
              {/* First Month */}
              <div className="calendar-month">
                {/* Day Names Header */}
                <div className="row g-1 mb-2">
                  {dayNames.map(day => (
                    <div key={day} className="col text-center">
                      <small className="text-charcoal-gray fw-semibold">{day}</small>
                    </div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div className="calendar-grid">
                  {Array.from({ length: Math.ceil(getDaysInMonth(currentMonth).length / 7) }, (_, weekIndex) => (
                    <div key={weekIndex} className="row g-1 mb-1">
                      {getDaysInMonth(currentMonth).slice(weekIndex * 7, (weekIndex + 1) * 7).map((date, dayIndex) => (
                        <div key={dayIndex} className="col">
                          {date ? (
                            <button
                              type="button"
                              className={`date-cell w-100 border-0 rounded-2 p-2 text-jet-black ${
                                isDateDisabled(date) ? 'disabled' :
                                isDateSelected(date) ? 'selected' :
                                isDateInRange(date) ? 'in-range' :
                                isDateHovered(date) ? 'hovered' : 'available'
                              }`}
                              onClick={() => handleDateClick(date)}
                              onMouseEnter={() => setHoveredDate(date)}
                              onMouseLeave={() => setHoveredDate(null)}
                              disabled={isDateDisabled(date)}
                            >
                              <small>{date.getDate()}</small>
                            </button>
                          ) : (
                            <div className="date-cell-empty p-2"></div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Second Month (only for roundtrip) */}
              {tripType === 'roundtrip' && (
                <div className="calendar-month">
                  {/* Day Names Header */}
                  <div className="row g-1 mb-2">
                    {dayNames.map(day => (
                      <div key={`second-${day}`} className="col text-center">
                        <small className="text-charcoal-gray fw-semibold">{day}</small>
                      </div>
                    ))}
                  </div>

                  {/* Calendar Grid for Second Month */}
                  <div className="calendar-grid">
                    {Array.from({ length: Math.ceil(getDaysInMonth(getNextMonth()).length / 7) }, (_, weekIndex) => (
                      <div key={weekIndex} className="row g-1 mb-1">
                        {getDaysInMonth(getNextMonth()).slice(weekIndex * 7, (weekIndex + 1) * 7).map((date, dayIndex) => (
                          <div key={dayIndex} className="col">
                            {date ? (
                              <button
                                type="button"
                                className={`date-cell w-100 border-0 rounded-2 p-2 text-jet-black ${
                                  isDateDisabled(date) ? 'disabled' :
                                  isDateSelected(date) ? 'selected' :
                                  isDateInRange(date) ? 'in-range' :
                                  isDateHovered(date) ? 'hovered' : 'available'
                                }`}
                                onClick={() => handleDateClick(date)}
                                onMouseEnter={() => setHoveredDate(date)}
                                onMouseLeave={() => setHoveredDate(null)}
                                disabled={isDateDisabled(date)}
                              >
                                <small>{date.getDate()}</small>
                              </button>
                            ) : (
                              <div className="date-cell-empty p-2"></div>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Selection Info */}
            <div className="mt-4 pt-3 border-top border-charcoal-gray border-opacity-25">
              <div className="d-flex justify-content-between align-items-center">
                <span className="text-charcoal-gray">
                  {tripType === 'roundtrip' ? (
                    selectingStart ? (
                      <><i className="bi bi-circle-fill text-primary me-2" style={{fontSize: '8px'}}></i>Select departure date</>
                    ) : (
                      <><i className="bi bi-circle-fill text-success me-2" style={{fontSize: '8px'}}></i>Select return date</>
                    )
                  ) : (
                    <><i className="bi bi-circle-fill text-primary me-2" style={{fontSize: '8px'}}></i>Select departure date</>
                  )}
                </span>
                {startDate && endDate && tripType === 'roundtrip' && (
                  <span className="text-success fw-semibold">
                    <i className="bi bi-moon me-1"></i>
                    {Math.ceil((parseDate(endDate)!.getTime() - parseDate(startDate)!.getTime()) / (1000 * 60 * 60 * 24))} nights
                  </span>
                )}
                {tripType === 'oneway' && startDate && (
                  <span className="text-primary fw-semibold">
                    <i className="bi bi-check-circle me-1"></i>
                    Date selected
                  </span>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

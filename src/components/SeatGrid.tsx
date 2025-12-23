import { cn } from '@/lib/utils';

interface Seat {
  id: string;
  seat_id: string;
  status: 'AVAILABLE' | 'HELD' | 'BOOKED';
  hold_expires_at: string | null;
  booked_by: string | null;
  booked_at: string | null;
  hold_id: string | null;
  held_by: string | null;
  show_id: string;
}

interface SeatGridProps {
  seats: Seat[];
  selectedSeat: Seat | null;
  onSelectSeat: (seat: Seat) => void;
  disabled?: boolean;
}

export function SeatGrid({ seats, selectedSeat, onSelectSeat, disabled }: SeatGridProps) {
  const getSeatStyles = (seat: Seat) => {
    const isSelected = selectedSeat?.id === seat.id;
    
    const baseStyles = "relative flex flex-col items-center justify-center p-2 border-2 rounded-md cursor-pointer transition-all duration-200 min-w-[70px] h-[60px] font-mono text-sm";
    
    if (seat.status === 'AVAILABLE') {
      return cn(
        baseStyles,
        "bg-seat-available border-seat-available-border hover:scale-105",
        isSelected && "ring-2 ring-primary ring-offset-2"
      );
    }
    
    if (seat.status === 'HELD') {
      return cn(
        baseStyles,
        "bg-seat-held border-seat-held-border animate-pulse-gentle cursor-not-allowed"
      );
    }
    
    if (seat.status === 'BOOKED') {
      return cn(
        baseStyles,
        "bg-seat-booked border-seat-booked-border cursor-not-allowed"
      );
    }
    
    return baseStyles;
  };

  const handleClick = (seat: Seat) => {
    if (disabled || seat.status !== 'AVAILABLE') return;
    onSelectSeat(seat);
  };

  // Sort seats by seat_id (A1, A2, ..., A30)
  const sortedSeats = [...seats].sort((a, b) => {
    const numA = parseInt(a.seat_id.replace('A', ''));
    const numB = parseInt(b.seat_id.replace('A', ''));
    return numA - numB;
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">All Seats</h2>
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
        {sortedSeats.map((seat) => (
          <div
            key={seat.id}
            className={getSeatStyles(seat)}
            onClick={() => handleClick(seat)}
          >
            <span className="font-bold">{seat.seat_id}</span>
            <span className="text-xs uppercase">{seat.status}</span>
          </div>
        ))}
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-seat-available border border-seat-available-border"></div>
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-seat-held border border-seat-held-border"></div>
          <span>Held</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-seat-booked border border-seat-booked-border"></div>
          <span>Booked</span>
        </div>
      </div>
    </div>
  );
}

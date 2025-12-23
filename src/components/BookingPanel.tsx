import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, XCircle } from 'lucide-react';

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

interface BookingState {
  bookingId: string | null;
  seatId: string | null;
  customerName: string;
  status: 'IDLE' | 'HELD' | 'CONFIRMED' | 'CANCELLED';
  holdExpiresAt: Date | null;
}

interface BookingPanelProps {
  seats: Seat[];
  selectedSeat: Seat | null;
  onSelectSeat: (seat: Seat | null) => void;
  bookingState: BookingState;
  onNameChange: (name: string) => void;
  onHoldSeat: (name: string) => void;
  onConfirmPayment: () => void;
  onCancelHold: () => void;
  timeRemaining: number;
  loading: boolean;
  disabled?: boolean;
}

export function BookingPanel({
  seats,
  selectedSeat,
  onSelectSeat,
  bookingState,
  onNameChange,
  onHoldSeat,
  onConfirmPayment,
  onCancelHold,
  timeRemaining,
  loading,
  disabled
}: BookingPanelProps) {
  const [name, setName] = useState(bookingState.customerName);

  useEffect(() => {
    setName(bookingState.customerName);
  }, [bookingState.customerName]);

  const handleNameChange = (value: string) => {
    setName(value);
    onNameChange(value);
  };

  const availableSeats = seats.filter(s => s.status === 'AVAILABLE');

  const getStatusIcon = () => {
    if (bookingState.status === 'HELD') {
      return <Clock className="h-4 w-4 text-status-warning" />;
    }
    if (bookingState.status === 'CONFIRMED') {
      return <CheckCircle className="h-4 w-4 text-status-success" />;
    }
    return null;
  };

  const getStatusBadge = () => {
    if (bookingState.status === 'HELD') {
      return (
        <Badge variant="outline" className="bg-seat-held border-seat-held-border">
          HELD ({timeRemaining}s remaining)
        </Badge>
      );
    }
    if (bookingState.status === 'CONFIRMED') {
      return (
        <Badge variant="outline" className="bg-status-success text-white">
          CONFIRMED
        </Badge>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4 p-4 bg-card rounded-lg border">
      {/* Seat Selection */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Seat:</label>
          <Select
            value={selectedSeat?.seat_id || ''}
            onValueChange={(value) => {
              const seat = seats.find(s => s.seat_id === value);
              onSelectSeat(seat || null);
            }}
            disabled={disabled || bookingState.status === 'HELD'}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {availableSeats.map((seat) => (
                <SelectItem key={seat.id} value={seat.seat_id}>
                  {seat.seat_id}
                </SelectItem>
              ))}
              {selectedSeat && selectedSeat.status !== 'AVAILABLE' && (
                <SelectItem value={selectedSeat.seat_id}>
                  {selectedSeat.seat_id}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Name Input */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <label className="text-sm font-medium whitespace-nowrap">Name:</label>
          <Input
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Enter your name"
            disabled={disabled || bookingState.status === 'HELD'}
            className="max-w-[200px]"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => onHoldSeat(name)}
          disabled={disabled || loading || !selectedSeat || bookingState.status === 'HELD'}
          variant="outline"
        >
          Checkout (Hold Seat)
        </Button>
        
        <Button
          onClick={onConfirmPayment}
          disabled={disabled || loading || bookingState.status !== 'HELD'}
          variant="outline"
        >
          Confirm (mock payment)
        </Button>
        
        <Button
          onClick={onCancelHold}
          disabled={disabled || loading || bookingState.status !== 'HELD'}
          variant="outline"
        >
          Cancel Hold
        </Button>
      </div>

      {/* Status Display */}
      {bookingState.status !== 'IDLE' && (
        <div className="space-y-2 p-3 bg-muted rounded-md font-mono text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium">Status:</span>
            {getStatusIcon()}
            {getStatusBadge()}
            {bookingState.bookingId && (
              <span className="text-muted-foreground text-xs ml-2">
                bookingId={bookingState.bookingId}
              </span>
            )}
          </div>
          
          {bookingState.bookingId && (
            <div className="text-muted-foreground">
              <strong>bookingId:</strong> {bookingState.bookingId}
            </div>
          )}
          
          {bookingState.customerName && (
            <div className="text-muted-foreground">
              <strong>held by:</strong> {bookingState.customerName}
            </div>
          )}
        </div>
      )}

      {/* Seat Snapshot */}
      {selectedSeat && (
        <div className="space-y-2">
          <h3 className="font-semibold">Seat Snapshot</h3>
          <pre className="p-3 bg-muted rounded-md text-sm font-mono overflow-x-auto">
{JSON.stringify({
  seatId: selectedSeat.seat_id,
  status: selectedSeat.status,
  holdExpiresAt: selectedSeat.hold_expires_at,
  bookedBy: selectedSeat.booked_by,
  bookedAt: selectedSeat.booked_at,
  holdId: selectedSeat.hold_id
}, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

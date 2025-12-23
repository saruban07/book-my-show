import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

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

interface Show {
  id: string;
  name: string;
  created_at: string;
}

interface BookingState {
  bookingId: string | null;
  seatId: string | null;
  customerName: string;
  status: 'IDLE' | 'HELD' | 'CONFIRMED' | 'CANCELLED';
  holdExpiresAt: Date | null;
}

const HOLD_DURATION_SECONDS = 20;
const BOOKING_STORAGE_KEY = 'bms_current_booking';

export function useBooking() {
  const [shows, setShows] = useState<Show[]>([]);
  const [currentShow, setCurrentShow] = useState<Show | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [loading, setLoading] = useState(false);
  const [bookingState, setBookingState] = useState<BookingState>(() => {
    // Restore from localStorage on initial load
    const saved = localStorage.getItem(BOOKING_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          holdExpiresAt: parsed.holdExpiresAt ? new Date(parsed.holdExpiresAt) : null
        };
      } catch {
        return {
          bookingId: null,
          seatId: null,
          customerName: '',
          status: 'IDLE',
          holdExpiresAt: null
        };
      }
    }
    return {
      bookingId: null,
      seatId: null,
      customerName: '',
      status: 'IDLE',
      holdExpiresAt: null
    };
  });
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  const { user } = useAuth();
  const { toast } = useToast();

  // Persist booking state to localStorage
  useEffect(() => {
    if (bookingState.status !== 'IDLE') {
      localStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify({
        ...bookingState,
        holdExpiresAt: bookingState.holdExpiresAt?.toISOString()
      }));
    } else {
      localStorage.removeItem(BOOKING_STORAGE_KEY);
    }
  }, [bookingState]);

  // Timer countdown for held seats
  useEffect(() => {
    if (bookingState.status !== 'HELD' || !bookingState.holdExpiresAt) {
      setTimeRemaining(0);
      return;
    }

    const interval = setInterval(() => {
      const now = new Date();
      const remaining = Math.max(0, Math.floor((bookingState.holdExpiresAt!.getTime() - now.getTime()) / 1000));
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        // Auto-release the seat
        releaseHold();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [bookingState.status, bookingState.holdExpiresAt]);

  const fetchShows = useCallback(async () => {
    const { data, error } = await supabase
      .from('shows')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching shows:', error);
      return;
    }

    setShows(data || []);
    if (data && data.length > 0 && !currentShow) {
      setCurrentShow(data[0]);
    }
  }, [currentShow]);

  const fetchSeats = useCallback(async () => {
    if (!currentShow) return;

    // First release expired holds
    await supabase.rpc('release_expired_holds');

    const { data, error } = await supabase
      .from('seats')
      .select('*')
      .eq('show_id', currentShow.id)
      .order('seat_id');

    if (error) {
      console.error('Error fetching seats:', error);
      return;
    }

    setSeats((data || []) as Seat[]);
    
    // Update selected seat if it exists
    if (selectedSeat) {
      const updated = data?.find(s => s.id === selectedSeat.id);
      if (updated) {
        setSelectedSeat(updated as Seat);
      }
    }

    // Restore booking state on refresh
    if (bookingState.seatId && bookingState.status === 'HELD') {
      const heldSeat = data?.find(s => s.id === bookingState.seatId);
      if (heldSeat) {
        // Check if hold is still valid
        if (heldSeat.status === 'HELD' && heldSeat.hold_expires_at) {
          const expiresAt = new Date(heldSeat.hold_expires_at);
          if (expiresAt > new Date()) {
            setSelectedSeat(heldSeat as Seat);
            setBookingState(prev => ({
              ...prev,
              holdExpiresAt: expiresAt
            }));
          } else {
            // Hold expired, reset state
            setBookingState({
              bookingId: null,
              seatId: null,
              customerName: '',
              status: 'IDLE',
              holdExpiresAt: null
            });
          }
        }
      }
    }
  }, [currentShow, selectedSeat, bookingState.seatId, bookingState.status]);

  useEffect(() => {
    fetchShows();
  }, [fetchShows]);

  useEffect(() => {
    if (currentShow) {
      fetchSeats();
    }
  }, [currentShow, fetchSeats]);

  const seedShow = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to create a show",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Create new show
      const { data: show, error: showError } = await supabase
        .from('shows')
        .insert({ name: 'Show' })
        .select()
        .single();

      if (showError) throw showError;

      // Create 30 seats
      const seatLabels = [];
      for (let i = 1; i <= 30; i++) {
        seatLabels.push(`A${i}`);
      }

      const seatsToInsert = seatLabels.map(label => ({
        show_id: show.id,
        seat_id: label,
        status: 'AVAILABLE'
      }));

      const { error: seatsError } = await supabase
        .from('seats')
        .insert(seatsToInsert);

      if (seatsError) throw seatsError;

      setCurrentShow(show);
      await fetchShows();
      await fetchSeats();

      toast({
        title: "Show Created",
        description: `Created show with 30 seats`
      });
    } catch (error: any) {
      console.error('Error seeding show:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create show",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const holdSeat = async (customerName: string) => {
    if (!user || !selectedSeat || !currentShow) {
      toast({
        title: "Error",
        description: "Please select a seat and enter your name",
        variant: "destructive"
      });
      return;
    }

    if (!customerName.trim()) {
      toast({
        title: "Error",
        description: "Please enter your name",
        variant: "destructive"
      });
      return;
    }

    // Refresh to check current status
    await fetchSeats();
    const currentSeat = seats.find(s => s.id === selectedSeat.id);
    if (currentSeat?.status !== 'AVAILABLE') {
      toast({
        title: "Seat Unavailable",
        description: "This seat is no longer available. Please select another.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const holdExpiresAt = new Date(Date.now() + HOLD_DURATION_SECONDS * 1000);
      const bookingId = crypto.randomUUID();

      // Update seat to HELD
      const { error: seatError } = await supabase
        .from('seats')
        .update({
          status: 'HELD',
          hold_expires_at: holdExpiresAt.toISOString(),
          hold_id: bookingId,
          held_by: customerName.trim()
        })
        .eq('id', selectedSeat.id)
        .eq('status', 'AVAILABLE');

      if (seatError) throw seatError;

      // Create booking record
      const { error: bookingError } = await supabase
        .from('bookings')
        .insert({
          id: bookingId,
          seat_id: selectedSeat.id,
          user_id: user.id,
          customer_name: customerName.trim(),
          status: 'HELD',
          hold_expires_at: holdExpiresAt.toISOString()
        });

      if (bookingError) throw bookingError;

      setBookingState({
        bookingId,
        seatId: selectedSeat.id,
        customerName: customerName.trim(),
        status: 'HELD',
        holdExpiresAt
      });

      await fetchSeats();

      toast({
        title: "Seat Held",
        description: `Seat ${selectedSeat.seat_id} held for ${HOLD_DURATION_SECONDS} seconds`
      });
    } catch (error: any) {
      console.error('Error holding seat:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to hold seat",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const confirmPayment = async () => {
    if (!user || !bookingState.bookingId || !bookingState.seatId) {
      toast({
        title: "Error",
        description: "No active booking to confirm",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Update seat to BOOKED
      const { error: seatError } = await supabase
        .from('seats')
        .update({
          status: 'BOOKED',
          hold_expires_at: null,
          hold_id: null,
          held_by: null,
          booked_by: bookingState.customerName,
          booked_at: new Date().toISOString()
        })
        .eq('id', bookingState.seatId)
        .eq('hold_id', bookingState.bookingId);

      if (seatError) throw seatError;

      // Update booking to CONFIRMED
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({
          status: 'CONFIRMED',
          confirmed_at: new Date().toISOString()
        })
        .eq('id', bookingState.bookingId);

      if (bookingError) throw bookingError;

      const seatId = selectedSeat?.seat_id;

      setBookingState({
        bookingId: null,
        seatId: null,
        customerName: '',
        status: 'CONFIRMED',
        holdExpiresAt: null
      });

      await fetchSeats();

      toast({
        title: "Booking Confirmed!",
        description: `Seat ${seatId} successfully booked for ${bookingState.customerName}`
      });

      // Reset after showing success
      setTimeout(() => {
        setBookingState({
          bookingId: null,
          seatId: null,
          customerName: '',
          status: 'IDLE',
          holdExpiresAt: null
        });
      }, 2000);
    } catch (error: any) {
      console.error('Error confirming payment:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to confirm payment",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const releaseHold = async () => {
    if (!bookingState.seatId) return;

    setLoading(true);
    try {
      // Update seat to AVAILABLE
      const { error: seatError } = await supabase
        .from('seats')
        .update({
          status: 'AVAILABLE',
          hold_expires_at: null,
          hold_id: null,
          held_by: null
        })
        .eq('id', bookingState.seatId);

      if (seatError) throw seatError;

      // Update booking to CANCELLED
      if (bookingState.bookingId) {
        const { error: bookingError } = await supabase
          .from('bookings')
          .update({ status: 'CANCELLED' })
          .eq('id', bookingState.bookingId);

        if (bookingError) console.error('Error cancelling booking:', bookingError);
      }

      setBookingState({
        bookingId: null,
        seatId: null,
        customerName: '',
        status: 'IDLE',
        holdExpiresAt: null
      });

      await fetchSeats();

      toast({
        title: "Hold Released",
        description: "The seat has been released"
      });
    } catch (error: any) {
      console.error('Error releasing hold:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to release hold",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    shows,
    currentShow,
    setCurrentShow,
    seats,
    selectedSeat,
    setSelectedSeat,
    bookingState,
    setBookingState,
    timeRemaining,
    loading,
    fetchSeats,
    seedShow,
    holdSeat,
    confirmPayment,
    releaseHold
  };
}

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useBooking } from '@/hooks/useBooking';
import { SeatGrid } from '@/components/SeatGrid';
import { BookingPanel } from '@/components/BookingPanel';
import { RefreshCw, LogOut, Plus, Ticket } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const {
    currentShow,
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
  } = useBooking();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleNameChange = (name: string) => {
    setBookingState(prev => ({ ...prev, customerName: name }));
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Ticket className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">Book My Show</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {user.email}
            </span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Controls */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={seedShow} disabled={loading} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Seed Show + 30 Seats
          </Button>
          <Button onClick={fetchSeats} disabled={loading} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Seats
          </Button>
        </div>

        {/* Show ID Display */}
        {currentShow && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">ShowId:</label>
            <Input
              value={currentShow.id}
              readOnly
              className="font-mono text-sm max-w-md bg-muted"
            />
          </div>
        )}

        {!currentShow ? (
          <div className="text-center py-12 bg-card rounded-lg border">
            <Ticket className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Shows Available</h2>
            <p className="text-muted-foreground mb-4">
              Create a new show to start booking seats
            </p>
            <Button onClick={seedShow} disabled={loading}>
              <Plus className="h-4 w-4 mr-2" />
              Create Show with 30 Seats
            </Button>
          </div>
        ) : (
          <>
            {/* Booking Panel */}
            <BookingPanel
              seats={seats}
              selectedSeat={selectedSeat}
              onSelectSeat={setSelectedSeat}
              bookingState={bookingState}
              onNameChange={handleNameChange}
              onHoldSeat={holdSeat}
              onConfirmPayment={confirmPayment}
              onCancelHold={releaseHold}
              timeRemaining={timeRemaining}
              loading={loading}
            />

            {/* Seat Grid */}
            <SeatGrid
              seats={seats}
              selectedSeat={selectedSeat}
              onSelectSeat={setSelectedSeat}
              disabled={bookingState.status === 'HELD'}
            />
          </>
        )}
      </main>
    </div>
  );
};

export default Index;

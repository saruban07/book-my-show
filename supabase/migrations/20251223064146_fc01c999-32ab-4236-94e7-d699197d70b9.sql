-- Create shows table
CREATE TABLE public.shows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Show',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create seats table with booking and hold functionality
CREATE TABLE public.seats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  show_id UUID NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
  seat_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'HELD', 'BOOKED')),
  hold_expires_at TIMESTAMP WITH TIME ZONE,
  booked_by TEXT,
  booked_at TIMESTAMP WITH TIME ZONE,
  hold_id UUID,
  held_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(show_id, seat_id)
);

-- Create bookings table to track booking transactions
CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seat_id UUID NOT NULL REFERENCES public.seats(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'HELD' CHECK (status IN ('HELD', 'CONFIRMED', 'CANCELLED')),
  hold_expires_at TIMESTAMP WITH TIME ZONE,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Shows policies (anyone can view, authenticated users can create)
CREATE POLICY "Anyone can view shows"
ON public.shows FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create shows"
ON public.shows FOR INSERT
TO authenticated
WITH CHECK (true);

-- Seats policies
CREATE POLICY "Anyone can view seats"
ON public.seats FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert seats"
ON public.seats FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update seats"
ON public.seats FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Bookings policies
CREATE POLICY "Users can view their own bookings"
ON public.bookings FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can create bookings"
ON public.bookings FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own bookings"
ON public.bookings FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Profiles policies
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid());

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to release expired holds
CREATE OR REPLACE FUNCTION public.release_expired_holds()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.seats
  SET 
    status = 'AVAILABLE',
    hold_expires_at = NULL,
    hold_id = NULL,
    held_by = NULL
  WHERE status = 'HELD' AND hold_expires_at < now();
  
  UPDATE public.bookings
  SET status = 'CANCELLED'
  WHERE status = 'HELD' AND hold_expires_at < now();
END;
$$;
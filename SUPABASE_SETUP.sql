-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.friendships (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  friend_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT friendships_pkey PRIMARY KEY (id),
  CONSTRAINT friendships_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT friendships_friend_id_fkey FOREIGN KEY (friend_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.inventory (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  item_id text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  CONSTRAINT inventory_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.player_maps (
  user_id uuid NOT NULL,
  map_data jsonb,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT player_maps_pkey PRIMARY KEY (user_id),
  CONSTRAINT player_maps_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.plots (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  plot_index integer NOT NULL,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'empty'::text,
  seed_id text,
  days_planted integer DEFAULT 0,
  is_watered boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT plots_pkey PRIMARY KEY (id),
  CONSTRAINT plots_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  name text,
  avatar text,
  points integer DEFAULT 100,
  level integer DEFAULT 1,
  friends integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  bio text,
  exp integer DEFAULT 0,
  coins bigint DEFAULT '100'::bigint,
  energy bigint DEFAULT '100'::bigint,
  day bigint DEFAULT '1'::bigint,
  max_energy integer DEFAULT 100,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
/**
 * VenuesPanel Component
 *
 * Hierarchical list of venues with nested pitches.
 * Venues and pitches can be dragged onto games.
 * Click on venue to edit, drag to assign to match.
 * This is displayed INSIDE the right sidebar, not as a modal.
 */

import { useState, useEffect } from 'react';
import { supabase } from '../../../config/supabase';
import VenueModal from '../modals/VenueModal';

interface Pitch {
  id: string;
  name: string;
  include_in_season: boolean;
}

interface Venue {
  id: string;
  name: string;
  address?: string;
  pitches: Pitch[];
  include_in_season: boolean;
}

interface VenuesPanelProps {
  leagueId: string;
}

export default function VenuesPanel({ leagueId }: VenuesPanelProps) {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVenueId, setEditingVenueId] = useState<string | null>(null);

  useEffect(() => {
    loadVenues();
  }, [leagueId]);

  const loadVenues = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('venues')
        .select(`
          id,
          name,
          address,
          include_in_season,
          pitches (
            id,
            name,
            include_in_season
          )
        `)
        .eq('league_id', leagueId)
        .order('name');

      if (error) throw error;

      setVenues(data || []);
    } catch (err) {
      console.error('Error loading venues:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVenueClick = (venueId: string) => {
    setEditingVenueId(venueId);
    setIsModalOpen(true);
  };

  const handleAddVenue = () => {
    setEditingVenueId(null);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingVenueId(null);
    loadVenues(); // Reload venues after modal closes
  };

  return (
    <>
      <VenueModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        leagueId={leagueId}
        venueId={editingVenueId}
      />

      <div className="space-y-3">
        {/* Venues List */}
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-4 text-sm text-gray-500">
              Loading venues...
            </div>
          ) : venues.length === 0 ? (
            <div className="text-center py-4 text-sm text-gray-500">
              No venues found
            </div>
          ) : (
            venues.map((venue) => (
              <div key={venue.id} className="space-y-1">
                {/* Venue Header */}
                <div
                  className="p-2 bg-gray-50 hover:bg-gray-100 cursor-move transition-colors flex items-center justify-between text-sm group rounded"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('venueId', venue.id);
                    e.dataTransfer.setData('venueName', venue.name);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">
                      {venue.name}
                    </div>
                    {venue.address && (
                      <div className="text-xs text-gray-600 truncate">
                        {venue.address}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleVenueClick(venue.id);
                    }}
                    className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Edit
                  </button>
                </div>

                {/* Pitches (always visible, indented) */}
                {venue.pitches && venue.pitches.length > 0 && (
                  <div className="pl-4 space-y-1">
                    {venue.pitches.map((pitch) => (
                      <div
                        key={pitch.id}
                        className="px-2 py-1 hover:bg-gray-50 cursor-move transition-colors text-xs rounded"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('pitchId', pitch.id);
                          e.dataTransfer.setData('pitchName', pitch.name);
                          e.dataTransfer.setData('venueId', venue.id);
                          e.dataTransfer.setData('venueName', venue.name);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">├─</span>
                          <span className="text-gray-700">
                            {pitch.name}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
      </div>

        {/* Add Venue Button */}
        <button
          onClick={handleAddVenue}
          className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          + Add Venue
        </button>
      </div>
    </>
  );
}

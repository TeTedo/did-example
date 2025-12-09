"use client";

import { useState, useEffect, useCallback } from "react";
import { useSocket, useSocketEvent } from "@/lib/socket";
import { api } from "@/lib/api";

interface DIDEvent {
  type: "OwnerChanged" | "DelegateChanged" | "AttributeChanged";
  identity: string;
  blockNumber: number;
  transactionHash: string;
  timestamp: number;
  data: {
    owner?: string;
    delegate?: string;
    delegateType?: string;
    name?: string;
    value?: string;
    validTo?: number;
    previousChange?: number;
  };
}

interface EventStats {
  totalEvents: number;
  ownerChanges: number;
  delegateChanges: number;
  attributeChanges: number;
  uniqueIdentities: number;
}

export function EventDashboard() {
  const { isConnected } = useSocket();
  const [events, setEvents] = useState<DIDEvent[]>([]);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const loadEvents = useCallback(async () => {
    try {
      const data = await api.getEvents();
      setEvents(data.events || []);
    } catch (error) {
      console.error("Failed to load events:", error);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const data = await api.getStats();
      setStats(data);
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  }, []);

  // Load initial data
  useEffect(() => {
    loadEvents();
    loadStats();
  }, [loadEvents, loadStats]);

  // Listen for new events
  const handleNewEvent = useCallback(
    (event: DIDEvent) => {
      setEvents((prev) => [event, ...prev].slice(0, 100)); // Keep last 100 events
      loadStats(); // Refresh stats
    },
    [loadStats]
  );

  useSocketEvent("event:new", handleNewEvent);

  const filteredEvents = events.filter(
    (e) => filter === "all" || e.type === filter
  );

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <h3 className="text-sm font-medium text-gray-900">
            WebSocket Status
          </h3>
          <p className="text-xs text-gray-500">Real-time event streaming</p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`h-3 w-3 rounded-full ${
              isConnected ? "bg-green-500" : "bg-red-500"
            }`}
          />
          <span className="text-sm font-medium">
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Total Events"
            value={stats.totalEvents}
            color="blue"
          />
          <StatCard
            title="Owner Changes"
            value={stats.ownerChanges}
            color="purple"
          />
          <StatCard
            title="Delegate Changes"
            value={stats.delegateChanges}
            color="green"
          />
          <StatCard
            title="Attribute Changes"
            value={stats.attributeChanges}
            color="yellow"
          />
          <StatCard
            title="Unique Identities"
            value={stats.uniqueIdentities}
            color="pink"
          />
        </div>
      )}

      {/* Event Feed */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Live Event Feed
            </h3>
            <div className="flex gap-2">
              <FilterButton
                active={filter === "all"}
                onClick={() => setFilter("all")}
              >
                All
              </FilterButton>
              <FilterButton
                active={filter === "OwnerChanged"}
                onClick={() => setFilter("OwnerChanged")}
              >
                Owner
              </FilterButton>
              <FilterButton
                active={filter === "DelegateChanged"}
                onClick={() => setFilter("DelegateChanged")}
              >
                Delegate
              </FilterButton>
              <FilterButton
                active={filter === "AttributeChanged"}
                onClick={() => setFilter("AttributeChanged")}
              >
                Attribute
              </FilterButton>
            </div>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {filteredEvents.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No events yet. Perform some actions to see them here!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredEvents.map((event, index) => (
                <EventItem
                  key={`${event.transactionHash}-${index}`}
                  event={event}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: string;
}) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-700",
    purple: "bg-purple-50 text-purple-700",
    green: "bg-green-50 text-green-700",
    yellow: "bg-yellow-50 text-yellow-700",
    pink: "bg-pink-50 text-pink-700",
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p
        className={`mt-2 text-3xl font-bold ${
          colorClasses[color as keyof typeof colorClasses]
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
        active
          ? "bg-blue-600 text-white"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      }`}
    >
      {children}
    </button>
  );
}

function EventItem({ event }: { event: DIDEvent }) {
  const typeColors = {
    OwnerChanged: "bg-purple-100 text-purple-800",
    DelegateChanged: "bg-green-100 text-green-800",
    AttributeChanged: "bg-yellow-100 text-yellow-800",
  };

  const typeIcons = {
    OwnerChanged: "👤",
    DelegateChanged: "🔑",
    AttributeChanged: "📝",
  };

  return (
    <div className="p-4 hover:bg-gray-50">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <span className="text-2xl">{typeIcons[event.type]}</span>
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${
                  typeColors[event.type]
                }`}
              >
                {event.type}
              </span>
              <span className="text-xs text-gray-500">
                Block #{event.blockNumber}
              </span>
            </div>
            <p className="mt-1 font-mono text-sm text-gray-900">
              {event.identity.slice(0, 10)}...{event.identity.slice(-8)}
            </p>
            {event.type === "OwnerChanged" && event.data.owner && (
              <p className="mt-1 text-sm text-gray-600">
                New owner: {event.data.owner.slice(0, 10)}...
                {event.data.owner.slice(-8)}
              </p>
            )}
            {event.type === "DelegateChanged" && event.data.delegate && (
              <p className="mt-1 text-sm text-gray-600">
                Delegate: {event.data.delegate.slice(0, 10)}...
                {event.data.delegate.slice(-8)} ({event.data.delegateType})
              </p>
            )}
            {event.type === "AttributeChanged" && (
              <p className="mt-1 text-sm text-gray-600">
                Attribute: {event.data.name}
              </p>
            )}
          </div>
        </div>
        <a
          href={`https://etherscan.io/tx/${event.transactionHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:text-blue-800"
        >
          View TX →
        </a>
      </div>
    </div>
  );
}

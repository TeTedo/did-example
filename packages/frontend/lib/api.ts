const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const api = {
  // DID endpoints
  async getDIDDocument(address: string) {
    const res = await fetch(`${API_BASE_URL}/api/did/${address}`);
    if (!res.ok) throw new Error("Failed to fetch DID document");
    return res.json();
  },

  async getOwner(address: string) {
    const res = await fetch(`${API_BASE_URL}/api/did/${address}/owner`);
    if (!res.ok) throw new Error("Failed to fetch owner");
    return res.json();
  },

  async getDelegates(address: string) {
    const res = await fetch(`${API_BASE_URL}/api/did/${address}/delegates`);
    if (!res.ok) throw new Error("Failed to fetch delegates");
    return res.json();
  },

  async getAttributes(address: string) {
    const res = await fetch(`${API_BASE_URL}/api/did/${address}/attributes`);
    if (!res.ok) throw new Error("Failed to fetch attributes");
    return res.json();
  },

  // Event endpoints
  async getEvents(address?: string) {
    const url = address
      ? `${API_BASE_URL}/api/events/${address}`
      : `${API_BASE_URL}/api/events`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch events");
    return res.json();
  },

  async getStats() {
    const res = await fetch(`${API_BASE_URL}/api/events/stats/summary`);
    if (!res.ok) throw new Error("Failed to fetch stats");
    return res.json();
  },

  async getHealth() {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (!res.ok) throw new Error("Failed to fetch health");
    return res.json();
  },
};

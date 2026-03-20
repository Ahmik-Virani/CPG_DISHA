import { useEffect, useState } from "react";
import { CalendarPlus, Store, LogOut, ArrowUpRight, History, PlusCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { eventApi } from "../../lib/api";

function formatPaymentType(type) {
  if (type === "one_time") {
    return "One-Time";
  }

  if (type === "fixed") {
    return "Fixed";
  }

  return "Not Set";
}

export default function ManageEvent() {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const newEvents = events.filter((e) => e.isOngoing && !e.paymentRequestType);
  const currentEvents = events.filter((e) => e.isOngoing && e.paymentRequestType);
  const pastEvents = events.filter((e) => !e.isOngoing);

  useEffect(() => {
    let isMounted = true;

    async function loadEvents() {
      if (!token) {
        if (isMounted) {
          setEvents([]);
          setIsLoadingEvents(false);
        }
        return;
      }

      try {
        const data = await eventApi.listMine(token);
        if (isMounted) {
          setEvents(Array.isArray(data.events) ? data.events : []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Failed to load events");
        }
      } finally {
        if (isMounted) {
          setIsLoadingEvents(false);
        }
      }
    }

    loadEvents();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleCreateClick = () => {
    setError("");
    setSuccessMessage("");
    setIsCreating(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    if (!trimmedName || !trimmedDescription) {
      setError("Event name and description are required");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setSuccessMessage("");

    try {
      const data = await eventApi.create(token, {
        name: trimmedName,
        description: trimmedDescription,
      });
      setEvents((currentEvents) => [data.event, ...currentEvents]);
      setName("");
      setDescription("");
      setIsCreating(false);
      setSuccessMessage("Event created successfully");
    } catch (err) {
      setError(err.message || "Failed to create event");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-sky-50">
      <div className="flex justify-between items-center px-6 py-4 border-b bg-white">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-white p-2 rounded-lg">
            <Store size={20} />
          </div>
          <div>
            <h1 className="font-semibold text-lg">IIT Hyderabad Payment Gateway</h1>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/change-password" className="border px-4 py-2 rounded-lg">
            Change Password
          </Link>
          <button
            onClick={() => {
              logout();
              navigate("/");
            }}
            className="border px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      <div className="bg-sky-50 px-6 py-4">
        <div className="inline-flex bg-gray-200 p-1 rounded-full gap-1 flex-wrap">
          <button
            onClick={() => navigate("/system_head/manage-event")}
            className="flex items-center gap-2 px-5 py-2 rounded-full transition-all duration-200 bg-white shadow text-black"
          >
            <PlusCircle size={16} /> Manage Events
          </button>

          <button
            onClick={() => navigate("/system_head")}
            className="flex items-center gap-2 px-5 py-2 rounded-full transition-all duration-200 text-gray-600 hover:text-black"
          >
            <History size={16} /> Settlement History
          </button>
        </div>
      </div>

      <div className="p-6 md:p-8">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Manage Events</h2>
              <p className="text-gray-500">Create new events and view all existing events.</p>
            </div>

            <button
              type="button"
              onClick={handleCreateClick}
              className="inline-flex items-center justify-center gap-2 bg-black text-white px-5 py-2.5 rounded-lg"
            >
              <CalendarPlus size={16} /> Create Another Event
            </button>
          </div>

          {successMessage ? <p className="mt-4 text-sm text-green-700">{successMessage}</p> : null}
          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

          {isCreating ? (
            <form onSubmit={handleSubmit} className="mt-6 border border-gray-200 rounded-xl p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 outline-none"
                  placeholder="Enter event name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full min-h-32 border rounded-lg px-3 py-2 outline-none resize-y"
                  placeholder="Enter event description"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-black text-white px-5 py-2.5 rounded-lg disabled:opacity-60"
                >
                  {isSubmitting ? "Creating..." : "Create Event"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setError("");
                  }}
                  className="border px-5 py-2.5 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          {isLoadingEvents ? (
            <div className="mt-6 text-center text-gray-500">Loading events...</div>
          ) : events.length > 0 ? (
            <>
              {newEvents.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">New Events</h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {newEvents.map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => navigate("/system_head/manage-event/" + event.id, { state: { event } })}
                        className="group relative bg-amber-100 p-6 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer text-left"
                      >
                        <div className="absolute top-6 right-6 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                          <ArrowUpRight size={18} className="text-gray-600" />
                        </div>
                        <p className="text-lg font-semibold text-gray-900">{event.name}</p>
                        <p className="mt-2 text-sm text-gray-700">Type: {formatPaymentType(event.paymentRequestType)}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {currentEvents.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Current Events</h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {currentEvents.map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => navigate("/system_head/manage-event/" + event.id, { state: { event } })}
                        className="group relative bg-amber-200 p-6 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer text-left"
                      >
                        <div className="absolute top-6 right-6 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                          <ArrowUpRight size={18} className="text-gray-600" />
                        </div>
                        <p className="text-lg font-semibold text-gray-900">{event.name}</p>
                        <p className="mt-2 text-sm text-gray-700">Type: {formatPaymentType(event.paymentRequestType)}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {pastEvents.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Past Events</h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {pastEvents.map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => navigate("/system_head/manage-event/" + event.id, { state: { event } })}
                        className="group relative bg-green-300 p-6 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer text-left"
                      >
                        <div className="absolute top-6 right-6 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                          <ArrowUpRight size={18} className="text-gray-600" />
                        </div>
                        <p className="text-lg font-semibold text-gray-900">{event.name}</p>
                        <p className="mt-2 text-sm text-gray-700">Type: {formatPaymentType(event.paymentRequestType)}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="mt-6 border border-dashed border-gray-300 rounded-xl p-8 text-center">
              <p className="text-lg font-medium text-gray-700">No events as of now</p>
              <p className="text-sm text-gray-500 mt-1">
                Events from the current system head will be listed here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

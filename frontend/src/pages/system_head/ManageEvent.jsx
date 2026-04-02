import { useEffect, useState } from "react";
import { CalendarPlus, ArrowUpRight, History, PlusCircle, CreditCard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import { eventApi } from "../../lib/api";

function formatPaymentType(type) {
  if (type === "one_time") return "One-Time";
  if (type === "fixed") return "Fixed";
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
  const [paymentTypeTab, setPaymentTypeTab] = useState("one_time");

  const newEvents          = events.filter((e) => e.isOngoing && !e.paymentRequestType);
  const currentEvents      = events.filter((e) => e.isOngoing && e.paymentRequestType);
  const pastEvents         = events.filter((e) => !e.isOngoing);
  const currentEventsByType = currentEvents.filter((e) => e.paymentRequestType === paymentTypeTab);
  const pastEventsByType    = pastEvents.filter((e) => e.paymentRequestType === paymentTypeTab);

  useEffect(() => {
    let isMounted = true;
    async function loadEvents() {
      if (!token) {
        if (isMounted) { setEvents([]); setIsLoadingEvents(false); }
        return;
      }
      try {
        const data = await eventApi.listMine(token);
        if (isMounted) setEvents(Array.isArray(data.events) ? data.events : []);
      } catch (err) {
        if (isMounted) setError(err.message || "Failed to load events");
      } finally {
        if (isMounted) setIsLoadingEvents(false);
      }
    }
    loadEvents();
    return () => { isMounted = false; };
  }, [token]);

  const handleCreateClick = () => { setError(""); setSuccessMessage(""); setIsCreating(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    if (!trimmedName || !trimmedDescription) { setError("Event name and description are required"); return; }
    setIsSubmitting(true);
    setError("");
    setSuccessMessage("");
    try {
      const data = await eventApi.create(token, { name: trimmedName, description: trimmedDescription });
      setEvents((prev) => [data.event, ...prev]);
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
    <div className="min-h-screen bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url("/orangegrid.jpg")' }}>
      <div className="min-h-screen bg-orange-50/50">

      <Header variant="modern" />

      {/* ── Page nav tabs ── */}
      <div className="flex justify-center px-6 py-5">
        <div className="inline-flex bg-white border border-gray-200 shadow-sm p-1 rounded-full gap-1">
          <button
            onClick={() => navigate("/system_head/manage-event")}
            className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium bg-orange-400 text-white shadow transition-all duration-200"
          >
            <PlusCircle size={15} /> Manage Events
          </button>
          <button
            onClick={() => navigate("/system_head?tab=payment-history")}
            className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium text-gray-500 hover:text-gray-900 transition-all duration-200"
          >
            <CreditCard size={15} /> Payment History
          </button>
          <button
            onClick={() => navigate("/system_head")}
            className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium text-gray-500 hover:text-gray-900 transition-all duration-200"
          >
            <History size={15} /> Settlement History
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="px-6 pb-10">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">

          {/* Header row */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Manage Events</h2>
              <p className="text-sm text-gray-500 mt-0.5">Create new events and view all existing events.</p>
            </div>
            <button
              type="button"
              onClick={handleCreateClick}
              className="inline-flex items-center justify-center gap-2 bg-orange-400 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-orange-500 transition-colors shadow-sm"
            >
              <CalendarPlus size={16} /> Create Event
            </button>
          </div>

          {successMessage && <p className="mt-4 text-sm text-green-700">{successMessage}</p>}
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          {/* Create form */}
          {isCreating && (
            <form onSubmit={handleSubmit} className="mt-6 border border-gray-200 rounded-xl p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Event Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-600 transition-colors"
                  placeholder="Enter event name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Event Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full min-h-28 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-600 transition-colors resize-y"
                  placeholder="Enter event description"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-orange-400 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-orange-500 transition-colors disabled:opacity-60"
                >
                  {isSubmitting ? "Creating..." : "Create Event"}
                </button>
                <button
                  type="button"
                  onClick={() => { setIsCreating(false); setError(""); }}
                  className="border border-gray-200 px-5 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Events list */}
          {isLoadingEvents ? (
            <div className="mt-6 text-center text-gray-400 py-10">Loading events...</div>
          ) : events.length > 0 ? (
            <>
              {/* ── New Events — draft state, no payment configured yet ── */}
              {newEvents.length > 0 && (
                <div className="mt-10">
                  <h3 className="text-base font-semibold text-gray-700 mb-4">New Events</h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {newEvents.map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => navigate("/system_head/manage-event/" + event.id, { state: { event } })}
                        className="group relative bg-white border-2 border-dashed border-gray-300 p-5 rounded-2xl hover:border-gray-400 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer text-left"
                      >
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ArrowUpRight size={16} className="text-gray-500" />
                        </div>
                        <p className="text-base font-semibold text-gray-800 pr-5">{event.name}</p>
                        <p className="mt-2 text-xs text-gray-400 font-medium">Payment not configured</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Current Events — active, inline filter ── */}
              <div className="mt-10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-gray-700">Current Events</h3>
                  <div className="inline-flex bg-gray-100 p-1 rounded-full gap-1">
                    <button
                      type="button"
                      onClick={() => setPaymentTypeTab("one_time")}
                      className={`px-3.5 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                        paymentTypeTab === "one_time"
                          ? "bg-orange-400 text-white shadow"
                          : "text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      One-Time
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentTypeTab("fixed")}
                      className={`px-3.5 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                        paymentTypeTab === "fixed"
                          ? "bg-orange-400 text-white shadow"
                          : "text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      Fixed
                    </button>
                  </div>
                </div>

                {currentEventsByType.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {currentEventsByType.map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => navigate("/system_head/manage-event/" + event.id, { state: { event } })}
                        className="group relative bg-white border border-gray-200 p-5 rounded-2xl hover:border-orange-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer text-left"
                      >
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ArrowUpRight size={16} className="text-orange-600" />
                        </div>
                        <p className="text-base font-semibold text-gray-900 pr-5">{event.name}</p>
                        <p className="mt-2 text-xs text-orange-700 font-medium">{formatPaymentType(event.paymentRequestType)}</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="border border-dashed border-gray-200 rounded-xl p-6 text-center">
                    <p className="text-sm text-gray-400">No {paymentTypeTab === "one_time" ? "One-Time" : "Fixed"} events active</p>
                  </div>
                )}
              </div>

              {/* ── Past Events — faded, lower visual weight ── */}
              {pastEventsByType.length > 0 && (
                <div className="mt-10">
                  <h3 className="text-base font-semibold text-gray-400 mb-4">Past Events</h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {pastEventsByType.map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => navigate("/system_head/manage-event/" + event.id, { state: { event } })}
                        className="group relative bg-gray-50 border border-gray-200 p-5 rounded-2xl hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200 cursor-pointer text-left opacity-75 hover:opacity-100"
                      >
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ArrowUpRight size={16} className="text-gray-400" />
                        </div>
                        <p className="text-base font-semibold text-gray-500 pr-5">{event.name}</p>
                        <p className="mt-2 text-xs text-gray-400 font-medium">{formatPaymentType(event.paymentRequestType)}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="mt-6 border border-dashed border-gray-200 rounded-xl p-10 text-center">
              <p className="text-gray-500 font-medium">No events yet</p>
              <p className="text-sm text-gray-400 mt-1">Events you create will appear here.</p>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

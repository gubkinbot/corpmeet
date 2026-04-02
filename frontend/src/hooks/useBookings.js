import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getBookings, createBooking, updateBooking, deleteBooking, getActiveBookings, getAdminBookings } from "../lib/bookings";
import { getSlots } from "../lib/slots";

export function useBookings(dateStr) {
  return useQuery({
    queryKey: ["bookings", dateStr],
    queryFn: () => getBookings(dateStr, dateStr),
    enabled: !!dateStr,
    staleTime: 30000,
  });
}

export function useWeekBookings(dateFrom, dateTo) {
  return useQuery({
    queryKey: ["bookings", dateFrom, dateTo],
    queryFn: () => getBookings(dateFrom, dateTo),
    enabled: !!dateFrom && !!dateTo,
    staleTime: 30000,
  });
}

export function useSlots(dateStr, roomId) {
  return useQuery({
    queryKey: ["slots", dateStr, roomId],
    queryFn: () => getSlots(dateStr, roomId),
    enabled: !!dateStr,
    staleTime: 30000,
  });
}

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createBooking,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
  });
}

export function useUpdateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => updateBooking(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
  });
}

export function useDeleteBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, deleteSeries }) => deleteBooking(id, deleteSeries),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
  });
}

export function useActiveBookings() {
  return useQuery({
    queryKey: ["bookings", "active"],
    queryFn: getActiveBookings,
    staleTime: 30000,
  });
}

export function useAdminBookings() {
  return useQuery({
    queryKey: ["bookings", "admin"],
    queryFn: getAdminBookings,
    staleTime: 30000,
  });
}

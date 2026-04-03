import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { searchUsers, getAdminUsers, getAdminStats, createAdminUser, deleteAdminUser, changeUserRole, assignUserRoom, getRooms, setAdminRooms, getAdminRooms, createRoom, deleteRoom } from "../lib/users";

export function useUsers(query) {
  return useQuery({
    queryKey: ["users", "search", query],
    queryFn: () => searchUsers(query),
    enabled: !!query && query.length >= 1,
    staleTime: 10000,
  });
}

export function useRooms() {
  return useQuery({
    queryKey: ["rooms"],
    queryFn: getRooms,
    staleTime: 60000,
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ["users", "admin"],
    queryFn: getAdminUsers,
    staleTime: 30000,
  });
}

export function useAdminStats() {
  return useQuery({
    queryKey: ["users", "stats"],
    queryFn: getAdminStats,
    staleTime: 30000,
  });
}

export function useCreateAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAdminUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useDeleteAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteAdminUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useChangeUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }) => changeUserRole(id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useAssignUserRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, roomId }) => assignUserRoom(id, roomId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useSetAdminRooms() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, roomIds }) => setAdminRooms(id, roomIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useAdminRooms() {
  return useQuery({
    queryKey: ["rooms", "admin"],
    queryFn: getAdminRooms,
    staleTime: 30000,
  });
}

export function useCreateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createRoom,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rooms"] });
    },
  });
}

export function useDeleteRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteRoom,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rooms"] });
    },
  });
}

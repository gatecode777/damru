import type { ReservationStatus } from "@/models/Reservation";
import Reservation from "@/models/Reservation";
import { createNotification } from "@/lib/notifications/notificationService";

type StatusUpdateInput = {
  id: string;
  status: ReservationStatus;
  declineReason?: string;
};

export async function updateReservationStatus({ id, status, declineReason = "" }: StatusUpdateInput) {
  const reason = declineReason.trim();
  const statusUpdatedAt = new Date();
  const changeFilter = status === "cancelled"
    ? { _id: id, $or: [{ status: { $ne: status } }, { declineReason: { $ne: reason } }] }
    : { _id: id, status: { $ne: status } };
  const reservation = await Reservation.findOneAndUpdate(
    changeFilter,
    {
      $set: {
        status,
        declineReason: status === "cancelled" ? reason : "",
        statusUpdatedAt,
      },
    },
    { new: true }
  ).lean();

  if (!reservation) {
    return Reservation.findById(id).lean();
  }

  if (status === "confirmed" || status === "cancelled") {
    const declined = status === "cancelled";
    try {
      await createNotification({
        userId: reservation.userId,
        category: "SYSTEM",
        type: declined ? "RESERVATION_DECLINED" : "RESERVATION_CONFIRMED",
        title: declined ? "Reservation declined" : "Reservation confirmed",
        message: declined
          ? `We could not accept your reservation for ${reservation.date} at ${reservation.time}. Reason: ${reason}`
          : `Your reservation for ${reservation.date} at ${reservation.time} is confirmed.`,
        action: { label: "View reservation", route: "/my-profile" },
        data: { entityType: "reservation", entityId: String(reservation._id) },
        channels: ["IN_APP"],
        priority: "HIGH",
        dedupKey: `reservation:${reservation._id}:${status}:${statusUpdatedAt.getTime()}`,
        sourceType: "Reservation",
        sourceId: String(reservation._id),
      });
    } catch (error) {
      console.error("Reservation notification error:", error);
    }
  }

  return reservation;
}

import { createRoot } from "react-dom/client";
import { BikesInStorage } from "@/components/loading/BikesInStorage";
import type { StorageAllocation } from "@/pages/LoadingUnloadingPage";

const mk = (name: string, bay: string, position: number, when: string) => ({
  allocation: {
    id: `${bay}${position}`,
    orderId: `o-${name}`,
    bay,
    position,
    customerName: name,
    bikeBrand: "Trek",
    bikeModel: "Domane",
    allocatedAt: new Date(when),
  } as StorageAllocation,
  order: {
    trackingNumber: `CCC${name.toUpperCase()}`,
    status: "collected",
    delivery_driver_name: "",
    receiver: { address: { city: "London", zipCode: "E1 6AN" } },
    sender: { name: name },
    needsInspection: false,
    inspection_status: null,
    bikeValue: 1200,
  } as any,
});

export function mountSortPreview(el: HTMLElement) {
  createRoot(el).render(
    <BikesInStorage
      bikesInStorage={
        [
          mk("Charlie", "B", 2, "2026-11-05T09:00:00Z"),
          mk("alice", "A", 3, "2026-11-08T09:00:00Z"),
          mk("Bob", "A", 1, "2026-11-01T09:00:00Z"),
        ] as any
      }
      onRemoveFromStorage={() => {}}
      onRemoveAllBikesFromOrder={() => {}}
      onChangeLocation={() => {}}
      onClearBayPosition={() => {}}
      isAdmin
    />
  );
}

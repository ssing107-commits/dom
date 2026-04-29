import type { Timestamp } from "firebase/firestore";

export type RentDueType = "10일" | "말일";

/** 기숙사(건물) 형태 */
export type PropertyBuildingType = "아파트" | "원룸" | "투룸" | "단독주택" | "오피스텔" | "빌라";

/** 월세 / 전세 / 소유 */
export type HousingTenureType = "월세" | "전세" | "소유";

export const PROPERTY_BUILDING_TYPES: PropertyBuildingType[] = [
  "아파트",
  "원룸",
  "투룸",
  "단독주택",
  "오피스텔",
  "빌라",
];

export const HOUSING_TENURE_TYPES: HousingTenureType[] = ["월세", "전세", "소유"];

export type Dormitory = {
  id: string;
  name: string;
  address: string;
  password: string;
  capacity: number;
  contractStart: Timestamp;
  contractEnd: Timestamp;
  deposit: number;
  monthlyRent: number;
  rentDueType: RentDueType;
  installOptions: string[];
  /** 기본 제공 옵션(콤마로 입력해 배열 저장). 미입력 기존 문서 호환 */
  basicOptions?: string[];
  /** 미입력 기존 문서 호환 */
  propertyBuildingType?: PropertyBuildingType;
  housingTenureType?: HousingTenureType;
  landlord: {
    name: string;
    phone: string;
  };
  createdAt: Timestamp;
};

export type ResidentStatus = "active" | "scheduled" | "move_out_scheduled" | "moved_out";

/** 공실·정원 계산에서 제외(이미 점유)로 볼 상태 */
export function isOccupyingResidentStatus(status: ResidentStatus): boolean {
  return (
    status === "active" || status === "scheduled" || status === "move_out_scheduled"
  );
}

export type Resident = {
  id: string;
  dormitoryId: string;
  name: string;
  phone: string;
  roomLocation?: string;
  moveInDate: Timestamp;
  moveOutDate: Timestamp | null;
  status: ResidentStatus;
  memo: string;
  createdAt: Timestamp;
};

export type MoveRecordType = "move_in" | "move_out";

export type MoveRecord = {
  id: string;
  dormitoryId: string;
  residentId: string;
  residentName: string;
  type: MoveRecordType;
  date: Timestamp;
  note: string;
  createdAt: Timestamp;
};

export type MaintenanceStatus = "pending" | "in_progress" | "completed";

export type MaintenanceRecord = {
  id: string;
  dormitoryId: string;
  title: string;
  description: string;
  status: MaintenanceStatus;
  reportedAt: Timestamp;
  resolvedAt: Timestamp | null;
  cost: number | null;
};


"use client";

import { memo } from "react";

type AvatarSize = "sm" | "md" | "lg";

interface SolarAvatarProps {
  size?: AvatarSize;
  className?: string;
}

const sizeMap: Record<AvatarSize, { container: string; face: string; ray: string }> = {
  sm: {
    container: "w-6 h-6",
    face: "w-4 h-4",
    ray: "w-0.5 h-1",
  },
  md: {
    container: "w-8 h-8",
    face: "w-5 h-5",
    ray: "w-0.5 h-1.5",
  },
  lg: {
    container: "w-10 h-10",
    face: "w-6 h-6",
    ray: "w-1 h-2",
  },
};

/**
 * 솔라가이드 태양 캐릭터 아바타
 * - 오렌지-노란 그라데이션 배경
 * - 친근한 미소 표정
 * - 빛나는 광선
 */
function SolarAvatarComponent({ size = "md", className = "" }: SolarAvatarProps) {
  const sizes = sizeMap[size];

  return (
    <div
      className={`relative flex items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 via-amber-400 to-solar-orange ${sizes.container} ${className}`}
    >
      {/* 광선 효과 */}
      <div className="absolute inset-0">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <div
            key={angle}
            className={`absolute top-1/2 left-1/2 bg-gradient-to-t from-yellow-300 to-transparent rounded-full opacity-80 ${sizes.ray}`}
            style={{
              transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-${size === "sm" ? "10px" : size === "md" ? "14px" : "18px"})`,
            }}
          />
        ))}
      </div>

      {/* 태양 얼굴 */}
      <div
        className={`relative ${sizes.face} rounded-full bg-gradient-to-br from-yellow-300 via-amber-300 to-orange-400 flex items-center justify-center shadow-sm`}
      >
        {/* 눈 */}
        <div className="absolute flex gap-1" style={{ top: "30%" }}>
          <div
            className="bg-amber-800 rounded-full"
            style={{
              width: size === "sm" ? "2px" : size === "md" ? "3px" : "4px",
              height: size === "sm" ? "2px" : size === "md" ? "3px" : "4px",
            }}
          />
          <div
            className="bg-amber-800 rounded-full"
            style={{
              width: size === "sm" ? "2px" : size === "md" ? "3px" : "4px",
              height: size === "sm" ? "2px" : size === "md" ? "3px" : "4px",
            }}
          />
        </div>

        {/* 미소 */}
        <div
          className="absolute border-b-2 border-amber-800 rounded-b-full"
          style={{
            top: "50%",
            width: size === "sm" ? "6px" : size === "md" ? "8px" : "10px",
            height: size === "sm" ? "3px" : size === "md" ? "4px" : "5px",
          }}
        />

        {/* 볼 터치 */}
        <div
          className="absolute bg-orange-300 rounded-full opacity-60"
          style={{
            top: "45%",
            left: size === "sm" ? "2px" : size === "md" ? "3px" : "4px",
            width: size === "sm" ? "3px" : size === "md" ? "4px" : "5px",
            height: size === "sm" ? "2px" : size === "md" ? "3px" : "4px",
          }}
        />
        <div
          className="absolute bg-orange-300 rounded-full opacity-60"
          style={{
            top: "45%",
            right: size === "sm" ? "2px" : size === "md" ? "3px" : "4px",
            width: size === "sm" ? "3px" : size === "md" ? "4px" : "5px",
            height: size === "sm" ? "2px" : size === "md" ? "3px" : "4px",
          }}
        />
      </div>
    </div>
  );
}

export const SolarAvatar = memo(SolarAvatarComponent);

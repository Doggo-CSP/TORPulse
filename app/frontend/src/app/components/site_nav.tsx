"use client";

import { Avatar } from "@/components/avatar";
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from "@/components/dropdown";
import {
  Navbar,
  NavbarDivider,
  NavbarItem,
  NavbarLabel,
  NavbarSection,
  NavbarSpacer,
} from "@/components/navbar";
import { ShieldCheckIcon,
  ArrowRightStartOnRectangleIcon,
  ComputerDesktopIcon,
  ChevronDownIcon,
  Cog8ToothIcon,
  UserIcon,
} from "@heroicons/react/16/solid";
import { useAuth } from "@/hooks/use-auth";
import { SessionReviewBanner } from "@/components/session-review-banner";

export function SiteNav() {
  const { user, loading, signOut, revokeOtherSessions, dismissSessionReview } = useAuth();
  const isAdmin = !loading && user?.role === "admin";

  // Always available from the account menu (ASVS V7.4.3)
  const signOutOtherDevices = async () => {
    if (!window.confirm("ออกจากระบบในอุปกรณ์อื่นทั้งหมด? อุปกรณ์นี้จะยังเข้าสู่ระบบอยู่")) return;
    try {
      const revoked = await revokeOtherSessions();
      window.alert(`ออกจากระบบในอุปกรณ์อื่นแล้ว ${revoked} รายการ`);
    } catch {
      window.alert("ทำรายการไม่สำเร็จ กรุณาลองใหม่");
    }
  };

  return (
    <>
    <Navbar>
      {/* Brand logo */}
      <NavbarItem href="/" aria-label="หน้าแรก">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#4a7c59] font-mono text-sm font-bold text-white">
          TR
        </span>
        <NavbarLabel>TOR</NavbarLabel>
      </NavbarItem>

      <NavbarDivider className="max-lg:hidden" />

      {/* Main nav links */}
      <NavbarSection className="max-lg:hidden">
        <NavbarItem href="/">หน้าแรก</NavbarItem>
        <NavbarItem href="/saved">TOR ที่บันทึกไว้</NavbarItem>
        <NavbarItem href="/reports">รายงาน</NavbarItem>
        {isAdmin && <NavbarItem href="/admin">ผู้ดูแลระบบ</NavbarItem>}
      </NavbarSection>

      <NavbarSpacer />

      {/* Right-side actions */}
      <NavbarSection>
        {loading ? null : user ? (
          /* ── Logged-in user dropdown ── */
          <Dropdown>
            <DropdownButton as={NavbarItem}>
              <Avatar
                src={user.image ?? null}
                initials={user.name ? user.name[0].toUpperCase() : "U"}
                className="bg-[#4a7c59] text-white"
                square
              />
              <ChevronDownIcon className="size-4 text-zinc-500" />
            </DropdownButton>
            <DropdownMenu className="min-w-56" anchor="bottom end">
              <DropdownItem href="/profile">
                <UserIcon className="size-4" />
                <DropdownLabel>โปรไฟล์ของฉัน</DropdownLabel>
              </DropdownItem>
              <DropdownItem href="/settings">
                <Cog8ToothIcon className="size-4" />
                <DropdownLabel>ตั้งค่า</DropdownLabel>
              </DropdownItem>
              {/* Review or revoke what TORPulse may access, at Google (ASVS V10.7.3) */}
              <DropdownItem href="https://myaccount.google.com/connections">
                <ShieldCheckIcon className="size-4" />
                <DropdownLabel>จัดการสิทธิ์การเข้าถึงบัญชี Google</DropdownLabel>
              </DropdownItem>
              <DropdownItem onClick={() => void signOutOtherDevices()}>
                <ComputerDesktopIcon className="size-4" />
                <DropdownLabel>ออกจากระบบในอุปกรณ์อื่น</DropdownLabel>
              </DropdownItem>
              <DropdownDivider />
              <DropdownItem onClick={() => void signOut()}>
                <ArrowRightStartOnRectangleIcon className="size-4" />
                <DropdownLabel>ออกจากระบบ</DropdownLabel>
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        ) : (
          /* ── Guest — link to login ── */
          <NavbarItem
            href="/auth"
            className="rounded-full bg-primary px-4 py-1.5 font-medium !text-white hover:bg-primary/90"
          >
            เข้าสู่ระบบ
          </NavbarItem>
        )}
      </NavbarSection>
    </Navbar>
    {user?.sessionReview && (
      <SessionReviewBanner onRevoke={revokeOtherSessions} onDismiss={dismissSessionReview} />
    )}
    </>
  );
}
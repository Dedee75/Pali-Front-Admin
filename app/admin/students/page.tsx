"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./student.module.css";

// Backend Student API
const API_URL = "http://localhost:3000/students";
const API_URL_IMG = "http://localhost:3000/";
const ITEMS_PER_PAGE = 10;

interface StudentData {
  id: string;
  displayId: string;
  name: string;
  batch: string;
  phone: string;
  dob: string;
  town: string;
  city: string;
  image: string;
}

interface CurrentUser {
  id?: number;
  name?: string;
  email?: string;
  role?: string;
}
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read photo"));
    };
    reader.onerror = () => reject(new Error("Could not read photo"));
    reader.readAsDataURL(file);
  });
}
export default function AdminStudentPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  // --- STATE MANAGEMENT ---
  const [students, setStudents] = useState<StudentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Tracking IDs for Actions
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form State
  const defaultForm = {
    displayId: "",
    name: "",
    batch: "1",
    phone: "",
    dob: "20",
    town: "",
    city: "",
    image: "",
  };
  const [formData, setFormData] = useState(defaultForm);

  // --- 1. FETCH DATA (READ) ---
  // const fetchStudents = async () => {
  //   try {
  //     setIsLoading(true);
  //     const res = await fetch(API_URL);
  //     if (!res.ok) throw new Error("Failed to fetch");
  //     const data = await res.json();

  //     const formatted = data.map((item: any, index: number) => ({
  //       id: item.id.toString(),
  //       displayId: item.studentCode,
  //       name: item.name,
  //       batch: `Batch-${item.batchId}`,
  //       phone: item.phone,
  //       dob: item.age.toString(),
  //       town: item.township,
  //       city: item.region,
  //       image: item.image
  //         ? `${API_URL_IMG}student-images/${item.image}`
  //         : `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}`,
  //     }));
  //     formatted.sort((firstStudent: StudentData, secondStudent: StudentData) =>
  //       firstStudent.displayId.localeCompare(
  //         secondStudent.displayId,
  //         undefined,
  //         {
  //           numeric: true,
  //           sensitivity: "base",
  //         },
  //       ),
  //     );

  //     setStudents(formatted);
  //   } catch (error) {
  //     console.error("Error fetching students:", error);
  //   } finally {
  //     setIsLoading(false);
  //   }
  // };
  const fetchStudents = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();

      const formatted = data.map((item: any, index: number) => {
        // 🌟 ပုံလင့်ခ် အမှန်ဖြစ်အောင် စစ်ထုတ်ခြင်း
        let finalImageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}`;

        if (item.image) {
          if (item.image.startsWith("http")) {
            finalImageUrl = item.image;
          } else if (item.image.startsWith("/student-images/")) {
            finalImageUrl = `${API_URL_IMG}${item.image.substring(1)}`;
          } else {
            // DB ထဲတွင် ဖိုင်နာမည်သက်သက် (MY26-xxx.jpg) သာ ရှိနေလျှင်
            finalImageUrl = `${API_URL_IMG}student-images/${item.image}`;
          }
        }

        return {
          id: item.id.toString(),
          displayId: item.studentCode,
          name: item.name,
          batch: `Batch-${item.batchId}`,
          phone: item.phone,
          dob: item.age.toString(),
          town: item.township,
          city: item.region,
          image: finalImageUrl,
        };
      });

      formatted.sort((firstStudent: StudentData, secondStudent: StudentData) =>
        firstStudent.displayId.localeCompare(
          secondStudent.displayId,
          undefined,
          { numeric: true, sensitivity: "base" },
        ),
      );

      setStudents(formatted);
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser) as
          | CurrentUser
          | { user?: CurrentUser };

        const resolvedUser =
          "user" in parsedUser && parsedUser.user
            ? parsedUser.user
            : parsedUser;

        setCurrentUser(resolvedUser as CurrentUser);
      } catch (error) {
        console.error("Invalid user data in localStorage:", error);

        localStorage.removeItem("user");
      }
    }

    void fetchStudents();
  }, []);

  // --- HANDLERS ---

  const handleLogout = () => {
    localStorage.removeItem("accessToken");

    localStorage.removeItem("user");

    setCurrentUser(null);
    router.replace("/");
  };

  // Open Create Form
  const handleOpenCreate = () => {
    setFormData(defaultForm);
    setEditingId(null);
    setIsFormModalOpen(true);
  };

  // Open Edit Form
  const handleOpenEdit = (student: StudentData) => {
    setFormData({
      displayId: student.displayId,
      name: student.name,
      batch: student.batch.replace(/\D/g, ""),
      phone: student.phone,
      dob: student.dob,
      town: student.town,
      city: student.city,
      image: student.image,
    });
    setEditingId(student.id);
    setIsFormModalOpen(true);
  };
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64Image = await fileToDataUrl(file);
      setFormData({ ...formData, image: base64Image });
    } catch (error) {
      alert("Failed to read image.");
    }
  };
  // const handleSubmit = async (e: React.FormEvent) => {
  //   e.preventDefault();

  //   const payload = {
  //     name: formData.name,
  //     phone: formData.phone,
  //     township: formData.town,
  //     region: formData.city,
  //     batchId: parseInt(formData.batch) || 1,
  //     age: parseInt(formData.dob) || 20,
  //     gender: "Not Specified",
  //     occupation: "Student",
  //     image: formData.image,
  //   };

  //   try {
  //     if (editingId) {
  //       // UPDATE (PATCH)
  //       const res = await fetch(`${API_URL}/${editingId}`, {
  //         method: "PATCH",
  //         headers: { "Content-Type": "application/json" },
  //         body: JSON.stringify(payload),
  //       });
  //       if (!res.ok) throw new Error("Failed to update");
  //     } else {
  //       const res = await fetch(`${API_URL}/create`, {
  //         method: "POST",
  //         headers: { "Content-Type": "application/json" },
  //         body: JSON.stringify(payload),
  //       });
  //       if (!res.ok) throw new Error("Failed to create");
  //     }

  //     setIsFormModalOpen(false);
  //     fetchStudents(); // Data အသစ်ရရန် ပြန်ခေါ်မည် (Auto generate ID များ ရစေရန်)
  //   } catch (error) {
  //     console.error("Error saving student:", error);
  //     alert("Something went wrong!");
  //   }
  // };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 🌟 payload အမျိုးအစားကို any ပေးထားပါ
    const payload: any = {
      name: formData.name,
      phone: formData.phone,
      township: formData.town,
      region: formData.city,
      batchId: parseInt(formData.batch) || 1,
      age: parseInt(formData.dob) || 20,
      gender: "Not Specified",
      occupation: "Student",
      // ❌ ဒီနေရာမှာ image: formData.image လုံးဝ (လုံးဝ) မထည့်ရပါ ❌
    };

    // 🌟 ပုံအသစ် ရွေးချယ်ထားမှသာ (Base64 ပါမှသာ) Backend သို့ image ကို ထည့်ပို့ပါမည်
    if (formData.image && formData.image.startsWith("data:image/")) {
      payload.image = formData.image;
    }

    try {
      if (editingId) {
        const res = await fetch(`${API_URL}/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to update");
      } else {
        const res = await fetch(`${API_URL}/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to create");
      }

      setIsFormModalOpen(false);
      fetchStudents();
    } catch (error) {
      console.error("Error saving student:", error);
      alert("Something went wrong!");
    }
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // --- 3. DELETE FLOW ---
  const handleOpenDelete = (id: string) => {
    setDeletingId(id);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (deletingId) {
      try {
        const res = await fetch(`${API_URL}/${deletingId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to delete");

        setIsDeleteModalOpen(false);
        setDeletingId(null);
        fetchStudents();
      } catch (error) {
        console.error("Error deleting student:", error);
        alert("Failed to delete student");
      }
    }
  };

  // Search Filter
  const filteredStudents = students.filter(
    (student) =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.displayId.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredStudents.length / ITEMS_PER_PAGE),
  );

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

  const endIndex = Math.min(
    startIndex + ITEMS_PER_PAGE,
    filteredStudents.length,
  );

  const paginatedStudents = filteredStudents.slice(startIndex, endIndex);

  const firstVisiblePage = Math.max(
    1,
    Math.min(currentPage - 2, totalPages - 4),
  );

  const lastVisiblePage = Math.min(totalPages, firstVisiblePage + 4);

  const visiblePages = Array.from(
    {
      length: lastVisiblePage - firstVisiblePage + 1,
    },
    (_, index) => firstVisiblePage + index,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className={styles.container}>
      <header className={styles.navbar}>
        <div className={styles.navLeft}>
          <div className={styles.logoIcon}>A</div>
          <span className={styles.brandName}>Dhamma Admin</span>
        </div>
        <div className={styles.navRight}>
          <img
            src="https://i.pravatar.cc/150?img=47"
            alt="Profile"
            className={styles.profileImg}
          />
          <span className={styles.profileName}>
            {currentUser?.name ?? "Super Admin"}
          </span>
          <button
            type="button"
            className={styles.logoutBtn}
            onClick={handleLogout}
            title="Logout"
            aria-label="Logout"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#b8860b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </header>

      <div className={styles.layoutWrapper}>
        <aside className={styles.sidebar}>
          <button
            type="button"
            className={styles.sideBtn}
            onClick={() => router.push("/admin/admin")}
          >
            Users
          </button>

          <button
            type="button"
            className={styles.sideBtn}
            onClick={() => router.push("/admin/batches")}
          >
            Batches
          </button>

          <button
            type="button"
            className={styles.sideBtn}
            onClick={() => router.push("/admin/homeworks")}
          >
            Homework
          </button>

          <button
            type="button"
            className={`${styles.sideBtn} ${styles.activeBtn}`}
            onClick={() => router.push("/admin/students")}
            aria-current="page"
          >
            Students
          </button>
        </aside>

        {/* Main Content Area */}
        <main className={styles.mainContent}>
          <div className={styles.contentHeader}>
            <div>
              <h1 className={styles.pageTitle}>Students</h1>
              <p className={styles.pageSubtitle}>
                Manage all registered Students.
              </p>
            </div>

            <div className={styles.headerActions}>
              <div className={styles.filterDropdown}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#666"
                  strokeWidth="2"
                >
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                </svg>
                <span>Filter With Name</span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#666"
                  strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>

              <div className={styles.searchBox}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#666"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                  type="text"
                  placeholder="Search Here"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <button className={styles.btnAdd} onClick={handleOpenCreate}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="8.5" cy="7" r="4"></circle>
                  <line x1="20" y1="8" x2="20" y2="14"></line>
                  <line x1="23" y1="11" x2="17" y2="11"></line>
                </svg>
                Add New
              </button>
            </div>
          </div>

          {/* Loading Indicator */}
          {isLoading ? (
            <p style={{ padding: "20px" }}>Loading data from server...</p>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Student ID</th>
                    <th>image</th>
                    <th>Name</th>
                    <th>Phone Number</th>
                    <th>Age</th>
                    <th>Town</th>
                    <th>City</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStudents.length > 0 ? (
                    paginatedStudents.map((student, index) => (
                      <tr
                        key={student.id}
                        className={`${(startIndex + index) % 2 === 0 ? styles.rowEven : styles.rowOdd} ${styles.clickableRow}`}
                        onClick={() => handleOpenEdit(student)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleOpenEdit(student);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`Edit ${student.name}`}
                      >
                        <td className={styles.boldText}>{student.displayId}</td>
                        <td>
                          <img
                            src={student.image}
                            alt="Student"
                            className={styles.tableAvatar}
                          />
                        </td>
                        <td>
                          <div className={styles.boldText}>{student.name}</div>
                          <div className={styles.subText}>{student.batch}</div>
                        </td>
                        <td className={styles.boldText}>{student.phone}</td>
                        <td className={styles.boldText}>{student.dob}</td>
                        <td className={styles.boldText}>{student.town}</td>
                        <td className={styles.boldText}>{student.city}</td>
                        <td>
                          <div className={styles.actionButtonsRow}>
                            <button
                              type="button"
                              className={styles.deleteBtn}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleOpenDelete(student.id);
                              }}
                              onKeyDown={(event) => event.stopPropagation()}
                              title="Delete"
                              aria-label={`Delete ${student.name}`}
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#dc2626"
                                strokeWidth="2"
                              >
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={8}
                        style={{ textAlign: "center", padding: "20px" }}
                      >
                        No students found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className={styles.paginationFooter}>
            <div className={styles.entriesText}>
              {filteredStudents.length === 0
                ? "Showing 0 of 0 entries"
                : `Showing ${startIndex + 1}-${endIndex} of ${filteredStudents.length} entries`}
            </div>

            <div className={styles.paginationControls}>
              <button
                type="button"
                className={styles.pageBtn}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page"
              >
                &lt;
              </button>

              {visiblePages.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  className={`${styles.pageBtn} ${
                    currentPage === pageNumber ? styles.pageActive : ""
                  }`}
                  onClick={() => setCurrentPage(pageNumber)}
                  aria-current={currentPage === pageNumber ? "page" : undefined}
                >
                  {pageNumber}
                </button>
              ))}

              <button
                type="button"
                className={styles.pageBtn}
                onClick={() =>
                  setCurrentPage((page) => Math.min(totalPages, page + 1))
                }
                disabled={
                  currentPage === totalPages || filteredStudents.length === 0
                }
                aria-label="Next page"
              >
                &gt;
              </button>
            </div>
          </div>

          <div className={styles.footerBrand}>O-Technique-Myanmar-2026@</div>
        </main>
      </div>
      {isFormModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setIsFormModalOpen(false)}
        >
          <div
            className={styles.formModalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.formHeader}>
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
              >
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                <text
                  x="12"
                  y="14"
                  fill="white"
                  fontSize="10"
                  stroke="none"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  A
                </text>
              </svg>
            </div>

            <form onSubmit={handleSubmit} className={styles.formBody}>
              <div className={styles.profileImgContainer}>
                <img
                  src={formData.image || "https://i.pravatar.cc/150?img=1"}
                  alt="Profile"
                  className={styles.formProfileImg}
                />
              </div>

              <div className={styles.fileInputWrapper}>
                <label className={styles.fileLabel}>
                  <span className={styles.btnChooseFile}>choose file</span>
                  <span className={styles.fileText}>No file Chosen</span>
                  <input
                    type="file"
                    accept="image/*"
                    className={styles.hiddenFileInput}
                    onChange={handleFileChange}
                  />
                </label>
              </div>

              <input
                type="text"
                name="displayId"
                value={formData.displayId}
                readOnly
                className={styles.goldInput}
                placeholder="Student ID (Auto Generated)"
              />
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={styles.goldInput}
                placeholder="Student Name"
                required
              />
              <input
                type="number"
                name="dob"
                value={formData.dob}
                onChange={handleChange}
                className={styles.goldInput}
                placeholder="Age (e.g. 20)"
                required
              />
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className={styles.goldInput}
                placeholder="Phone Number"
                required
              />
              <input
                type="number"
                name="batch"
                value={formData.batch}
                onChange={handleChange}
                className={styles.goldInput}
                placeholder="Batch Number (e.g. 1)"
                required
              />
              <input
                type="text"
                name="town"
                value={formData.town}
                onChange={handleChange}
                className={styles.goldInput}
                placeholder="Township"
                required
              />
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className={styles.goldInput}
                placeholder="Region/City"
                required
              />

              <button type="submit" className={styles.btnConfirmForm}>
                {editingId ? "Update Student" : "Create Student"}
              </button>
            </form>
          </div>
        </div>
      )}
      {isDeleteModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setIsDeleteModalOpen(false)}
        >
          <div
            className={styles.deleteModalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.warningIconWrapper}>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#d32f2f"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </div>

            <h2 className={styles.deleteTitle}>Are you sure?</h2>
            <p className={styles.deleteDesc}>
              This action cannot be undone. All values associated with this
              student will be lost.
            </p>

            <div className={styles.deleteActions}>
              <button
                className={styles.btnDeleteField}
                onClick={handleConfirmDelete}
              >
                Delete
              </button>
              <button
                className={styles.btnCancelField}
                onClick={() => setIsDeleteModalOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

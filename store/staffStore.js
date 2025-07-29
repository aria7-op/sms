import crypto from 'crypto';

// In-memory store for staff/users
let staff = [
  {
    id: 1,
    firstName: 'Alice',
    lastName: 'Johnson',
    email: 'alice@example.com',
    phone: '+1111111111',
    designation: 'Mathematics Teacher',
    department: 'Mathematics',
    status: 'ACTIVE',
    gender: 'FEMALE',
    dateOfBirth: '1985-03-15',
    joiningDate: '2020-09-01',
    salary: 45000,
    address: '123 Main St, City, State 12345',
    emergencyContact: {
      name: 'John Johnson',
      relationship: 'Spouse',
      phone: '+1111111112'
    },
    bankDetails: {
      accountNumber: '1234567890',
      bankName: 'City Bank',
      ifscCode: 'CITY0001234'
    },
    documents: [
      {
        type: 'ID_PROOF',
        name: 'Driver License',
        url: 'https://example.com/documents/alice-id.pdf'
      }
    ],
    emailVerified: true,
    createdAt: '2024-06-14T10:00:00Z',
    updatedAt: '2024-06-14T10:00:00Z'
  },
  {
    id: 2,
    firstName: 'Bob',
    lastName: 'Smith',
    email: 'bob@example.com',
    phone: '+1222222222',
    designation: 'School Administrator',
    department: 'Administration',
    status: 'ACTIVE',
    gender: 'MALE',
    dateOfBirth: '1978-07-22',
    joiningDate: '2018-06-15',
    salary: 65000,
    address: '456 Oak Ave, City, State 12345',
    emergencyContact: {
      name: 'Sarah Smith',
      relationship: 'Spouse',
      phone: '+1222222223'
    },
    bankDetails: {
      accountNumber: '0987654321',
      bankName: 'National Bank',
      ifscCode: 'NATI0009876'
    },
    documents: [
      {
        type: 'ID_PROOF',
        name: 'Passport',
        url: 'https://example.com/documents/bob-id.pdf'
      }
    ],
    emailVerified: true,
    createdAt: '2024-06-13T09:30:00Z',
    updatedAt: '2024-06-13T09:30:00Z'
  },
  {
    id: 3,
    firstName: 'Carol',
    lastName: 'Lee',
    email: 'carol@example.com',
    phone: '+1333333333',
    designation: 'Science Teacher',
    department: 'Science',
    status: 'ACTIVE',
    gender: 'FEMALE',
    dateOfBirth: '1990-11-08',
    joiningDate: '2021-01-10',
    salary: 48000,
    address: '789 Pine St, City, State 12345',
    emergencyContact: {
      name: 'Mike Lee',
      relationship: 'Spouse',
      phone: '+1333333334'
    },
    bankDetails: {
      accountNumber: '1122334455',
      bankName: 'Community Bank',
      ifscCode: 'COMM0001122'
    },
    documents: [
      {
        type: 'ID_PROOF',
        name: 'State ID',
        url: 'https://example.com/documents/carol-id.pdf'
      }
    ],
    emailVerified: true,
    createdAt: '2024-06-12T08:45:00Z',
    updatedAt: '2024-06-12T08:45:00Z'
  },
  {
    id: 4,
    firstName: 'David',
    lastName: 'Wilson',
    email: 'david@example.com',
    phone: '+1444444444',
    designation: 'English Teacher',
    department: 'English',
    status: 'ACTIVE',
    gender: 'MALE',
    dateOfBirth: '1982-04-12',
    joiningDate: '2019-08-20',
    salary: 47000,
    address: '321 Elm St, City, State 12345',
    emergencyContact: {
      name: 'Lisa Wilson',
      relationship: 'Spouse',
      phone: '+1444444445'
    },
    bankDetails: {
      accountNumber: '5566778899',
      bankName: 'Regional Bank',
      ifscCode: 'REGI0005566'
    },
    documents: [
      {
        type: 'ID_PROOF',
        name: 'Driver License',
        url: 'https://example.com/documents/david-id.pdf'
      }
    ],
    emailVerified: true,
    createdAt: '2024-06-11T14:20:00Z',
    updatedAt: '2024-06-11T14:20:00Z'
  },
  {
    id: 5,
    firstName: 'Emma',
    lastName: 'Davis',
    email: 'emma@example.com',
    phone: '+1555555555',
    designation: 'Librarian',
    department: 'Library',
    status: 'ACTIVE',
    gender: 'FEMALE',
    dateOfBirth: '1988-09-30',
    joiningDate: '2022-03-01',
    salary: 42000,
    address: '654 Maple Dr, City, State 12345',
    emergencyContact: {
      name: 'Tom Davis',
      relationship: 'Spouse',
      phone: '+1555555556'
    },
    bankDetails: {
      accountNumber: '9988776655',
      bankName: 'Local Bank',
      ifscCode: 'LOCA0009988'
    },
    documents: [
      {
        type: 'ID_PROOF',
        name: 'Passport',
        url: 'https://example.com/documents/emma-id.pdf'
      }
    ],
    emailVerified: true,
    createdAt: '2024-06-10T11:15:00Z',
    updatedAt: '2024-06-10T11:15:00Z'
  }
];

class StaffStore {
  // Get all staff with pagination and filtering
  getAllStaff(options = {}) {
    const {
      page = 1,
      limit = 10,
      sort = 'createdAt',
      order = 'desc',
      search = '',
      status = '',
      department = '',
      designation = '',
      gender = ''
    } = options;

    let filteredStaff = [...staff];

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filteredStaff = filteredStaff.filter(user =>
        `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower) ||
        (user.phone && user.phone.includes(search)) ||
        (user.designation && user.designation.toLowerCase().includes(searchLower))
      );
    }

    // Apply status filter
    if (status) {
      filteredStaff = filteredStaff.filter(user => user.status === status);
    }

    // Apply department filter
    if (department) {
      filteredStaff = filteredStaff.filter(user => user.department === department);
    }

    // Apply designation filter
    if (designation) {
      filteredStaff = filteredStaff.filter(user => user.designation === designation);
    }

    // Apply gender filter
    if (gender) {
      filteredStaff = filteredStaff.filter(user => user.gender === gender);
    }

    // Apply sorting
    filteredStaff.sort((a, b) => {
      let aValue = a[sort];
      let bValue = b[sort];
      if (sort === 'createdAt' || sort === 'updatedAt' || sort === 'joiningDate' || sort === 'dateOfBirth') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }
      if (order === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedStaff = filteredStaff.slice(startIndex, endIndex);

    return {
      staff: paginatedStaff,
      pagination: {
        page,
        limit,
        total: filteredStaff.length,
        totalPages: Math.ceil(filteredStaff.length / limit)
      }
    };
  }

  // Get staff by ID
  getStaffById(id) {
    return staff.find(u => u.id === parseInt(id)) || null;
  }

  // Create new staff
  createStaff(userData) {
    const id = Math.max(...staff.map(s => s.id), 0) + 1;
    const now = new Date().toISOString();
    const newUser = {
      ...userData,
      id,
      createdAt: now,
      updatedAt: now
    };
    staff.push(newUser);
    return newUser;
  }

  // Update staff
  updateStaff(id, updateData) {
    const idx = staff.findIndex(u => u.id === parseInt(id));
    if (idx === -1) return null;
    staff[idx] = { ...staff[idx], ...updateData, updatedAt: new Date().toISOString() };
    return staff[idx];
  }

  // Delete staff
  deleteStaff(id) {
    const idx = staff.findIndex(u => u.id === parseInt(id));
    if (idx === -1) return false;
    staff.splice(idx, 1);
    return true;
  }

  // Stats
  getStats() {
    const total = staff.length;
    const active = staff.filter(u => u.status === 'ACTIVE').length;
    const inactive = staff.filter(u => u.status === 'INACTIVE').length;
    const suspended = staff.filter(u => u.status === 'SUSPENDED').length;
    const departments = staff.reduce((acc, u) => {
      acc[u.department] = (acc[u.department] || 0) + 1;
      return acc;
    }, {});
    const designations = staff.reduce((acc, u) => {
      acc[u.designation] = (acc[u.designation] || 0) + 1;
      return acc;
    }, {});
    return { total, active, inactive, suspended, departments, designations };
  }

  // Health check
  healthCheck() {
    return { status: 'ok', count: staff.length };
  }
}

export default new StaffStore(); 
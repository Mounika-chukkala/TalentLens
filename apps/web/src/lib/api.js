
const API_BASE_URL = "http://localhost:5000/api";
const TOKEN_KEY = "talentlens_access_token";


async function apiRequest(path, options = {}) {
  const token = getAccessToken();

  const headers = {
    ...(options.body && !(options.body instanceof FormData)
      ? { "Content-Type": "application/json" }
      : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const result = await response.json().catch(() => ({}));

    if (!response.ok) {
  if (response.status === 401) {
    clearAccessToken();
  }

  const error = new Error(
    result.message || result.error || `Request failed (${response.status})`,
  );

  error.status = response.status;
  throw error;
}
  

  return result;
}



export async function getRequisitions() {
  return apiRequest("/requisitions");
}

export async function createRequisition(requisition) {
  const result = await apiRequest("/requisitions", {
    method: "POST",
    body: JSON.stringify(requisition),
  });

  return result.data;
}

export async function getCandidates() {
  return apiRequest("/candidates");
}

export async function getCandidateById(candidateId, options = {}) {
  const result = await apiRequest(
    `/candidates/${candidateId}`,
    {
      signal: options.signal,
    },
  );

  return result.data;
}
export async function uploadResume(file) {
  const formData = new FormData();
  formData.append("resume", file);

  const result = await apiRequest("/candidates/upload", {
    method: "POST",
    body: formData,
  });

  return result.data;
}

export async function updateCandidateStage(candidateId, stage) {
  const result = await apiRequest(
    `/candidates/${candidateId}/stage`,
    {
      method: "PATCH",
      body: JSON.stringify({ stage }),
    },
  );

  return result.data;
}



export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveAccessToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function loginUser({ email, password }) {
  const response = await apiRequest("/auth/login", {
    method: "POST",
     headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ email, password }),
  });

  const token =
    response.token || response.data?.accessToken;

  const user =
    response.user || response.data?.user;

  if (!token || !user) {
    throw new Error(
      "Invalid login response from server."
    );
  }

  saveAccessToken(token);

  return user;
}

export async function getCurrentUser() {
  const response = await apiRequest("/auth/me");

  return (
    response.user ||
    response.data?.user ||
    response.data ||
    response
  );
}

export async function logoutUser() {
  clearAccessToken();
}


export async function getClientOrganizations() {
  const result = await apiRequest("/client-organizations");
  return result.data;
}

export async function createClientOrganization(name) {
  const result = await apiRequest("/client-organizations", {
    method: "POST",
    body: JSON.stringify({ name }),
  });

  return result.data;
}


// AI Resume Screening

export async function createScreeningJob({ requisitionId, name, topN }) {
  return apiRequest("/screenings/jobs", {
    method: "POST",
    body: JSON.stringify({ requisitionId, name, topN }),
  });
}

export async function uploadScreeningResumes(jobId, files) {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append("resumes", file);
  });

  return apiRequest(`/screenings/jobs/${jobId}/files`, {
    method: "POST",
    body: formData,
  });
}

export async function completeScreeningUpload(jobId) {
  return apiRequest(`/screenings/jobs/${jobId}/complete-upload`, {
    method: "POST",
  });
}

export async function startScreening(jobId) {
  return apiRequest(`/screenings/jobs/${jobId}/start`, {
    method: "POST",
  });
}

export async function getScreeningJob(jobId) {
  return apiRequest(`/screenings/jobs/${jobId}`);
}

export async function getScreeningResults(
  jobId,
  { page = 1, limit = 20, status } = {},
) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (status) params.set("status", status);

  return apiRequest(
    `/screenings/jobs/${jobId}/results?${params.toString()}`,
  );
}

export async function retryFailedScreenings(jobId) {
  return apiRequest(`/screenings/jobs/${jobId}/retry-failed`, {
    method: "POST",
  });
}
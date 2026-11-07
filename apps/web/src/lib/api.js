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

export async function getRequisitionById(requisitionId) {
  const result = await apiRequest(
    `/requisitions/${requisitionId}`
  );

  return result.data;
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
  const result = await apiRequest(`/candidates/${candidateId}`, {
    signal: options.signal,
  });

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
  const result = await apiRequest(`/candidates/${candidateId}/stage`, {
    method: "PATCH",
    body: JSON.stringify({ stage }),
  });

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
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const token = response.token || response.data?.accessToken;

  const user = response.user || response.data?.user;

  if (!token || !user) {
    throw new Error("Invalid login response from server.");
  }

  saveAccessToken(token);

  return user;
}

export async function getCurrentUser() {
  const response = await apiRequest("/auth/me");

  return response.user || response.data?.user || response.data || response;
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

export async function inviteClientContact({ email, clientOrganizationId }) {
  const result = await apiRequest("/invitations", {
    method: "POST",
    body: JSON.stringify({
      email,
      clientOrganizationId,
    }),
  });

  return result.data;
}

// AI Resume Screening
// Requisition Scorecards

export async function getScorecard(requisitionId) {
  return apiRequest(`/scorecards/${requisitionId}`);
}

export async function generateScorecard(requisitionId) {
  return apiRequest(`/scorecards/${requisitionId}/generate`, {
    method: "POST",
  });
}

export async function saveScorecard(requisitionId, criteria) {
  return apiRequest(`/scorecards/${requisitionId}`, {
    method: "PUT",
    body: JSON.stringify({ criteria }),
  });
}
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

  return apiRequest(`/screenings/jobs/${jobId}/results?${params.toString()}`);
}

export async function getRequisitionRankedCandidates(
  requisitionId,
  { page = 1, limit = 50 } = {},
) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  return apiRequest(
    `/screenings/requisitions/${requisitionId}/ranked-candidates?${params.toString()}`,
  );
}

export async function submitCandidatesToClient(payload) {
  return apiRequest("/submissions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
export async function retryFailedScreenings(jobId) {
  return apiRequest(`/screenings/jobs/${jobId}/retry-failed`, {
    method: "POST",
  });
}

export async function getScreeningResumeBlob(submissionId) {
  const token = getAccessToken();

  const response = await fetch(
    `${API_BASE_URL}/screenings/submissions/${submissionId}/resume`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );

  if (!response.ok) {
    if (response.status === 401) {
      clearAccessToken();
    }

    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || "Unable to open resume.");
  }

  return response.blob();
}

export async function getClientSubmissions() {
  const result = await apiRequest("/submissions/client");
  return result.data || [];
}

export async function updateClientCandidateFeedback(
  submissionId,
  candidateFeedbackId,
  { feedback, feedbackNote } = {},
) {
  const result = await apiRequest(
    `/submissions/${submissionId}/candidates/${candidateFeedbackId}/feedback`,
    {
      method: "PATCH",
      body: JSON.stringify({ feedback, feedbackNote }),
    },
  );

  return result.data;
}

export async function acceptClientInvitation({ token, fullName, password }) {
  const result = await apiRequest("/invitations/accept", {
    method: "POST",
    body: JSON.stringify({
      token,
      fullName,
      password,
    }),
  });

  return result;
}


export async function getRequisitionSubmissions(requisitionId) {
  const result = await apiRequest(
    `/submissions/requisition/${requisitionId}`,
  );

  return result.data || [];
}
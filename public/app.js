const $ = id => document.getElementById(id);

// API helper with CSRF protection
async function api(url, options = {}) {
  const headers = {
    ...(options.body
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...(options.headers || {})
  };

  if (options.method && options.method !== 'GET') {
    const csrfResponse = await fetch('/api/csrf');

    if (!csrfResponse.ok) {
      throw new Error('Unable to obtain security token.');
    }

    const csrf = await csrfResponse.json();

    headers['X-CSRF-Token'] = csrf.csrfToken;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin'
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed.');
  }

  return data;
}

// Display status
function showStatus(message) {
  $('status').textContent = message;
}

// Load public messages
async function loadMessages() {
  const messages = await api('/api/messages');

  const container = $('messages');

  container.replaceChildren();

  messages.forEach(item => {
    const card = document.createElement('div');
    card.className = 'message';

    const author = document.createElement('strong');
    author.textContent = item.username;

    const content = document.createElement('p');
    content.textContent = item.message;

    const date = document.createElement('small');
    date.textContent = item.created_at;

    card.append(author, content, date);

    container.appendChild(card);
  });
}

// Check authentication status
async function checkLogin() {
  const data = await api('/api/auth/me');

  $('auth').hidden = !!data.user;
  $('userPanel').hidden = !data.user;

  if (data.user) {
    $('username').textContent = data.user.username;
  }
}

// Registration
$('registerForm').addEventListener('submit', async e => {
  e.preventDefault();

  try {
    const form = new FormData(e.target);

    await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(
        Object.fromEntries(form)
      )
    });

    showStatus('Registration successful!');

    e.target.reset();

    await checkLogin();

  } catch (err) {
    showStatus(err.message);
  }
});

// Login
$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();

  try {
    const form = new FormData(e.target);

    await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(
        Object.fromEntries(form)
      )
    });

    showStatus('Login successful!');

    e.target.reset();

    await checkLogin();

  } catch (err) {
    showStatus(err.message);
  }
});

// Logout
$('logoutBtn').addEventListener('click', async () => {
  try {
    await api('/api/auth/logout', {
      method: 'POST'
    });

    showStatus('You have logged out.');

    await checkLogin();

  } catch (err) {
    showStatus(err.message);
  }
});

// Post message
$('messageForm').addEventListener('submit', async e => {
  e.preventDefault();

  try {
    const message = new FormData(e.target)
      .get('message');

    await api('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ message })
    });

    showStatus(
      'Success! Your message has been published.'
    );

    e.target.reset();

    $('counter').textContent = '0 / 500';

    await loadMessages();

  } catch (err) {
    showStatus(err.message);
  }
});

// Character counter
$('messageForm')
  .querySelector('textarea')
  .addEventListener('input', e => {
    $('counter').textContent =
      `${e.target.value.length} / 500`;
  });

// Initialize application
async function init() {
  try {
    await checkLogin();
    await loadMessages();

  } catch (err) {
    showStatus(err.message);
  }
}

init();

import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Materials from './Materials';
import { mockFetch } from '../test/mockFetch';
import { renderWithAuth, users } from '../test/renderWithAuth';

const material = {
  id: 'm1',
  title: 'TCP handshake',
  subject: 'Networks',
  topic: 'Transport',
  description: '',
  originalName: 'tcp.pdf',
  format: 'pdf',
  size: 2 * 1024 * 1024,
};

const fileOfSize = (size, name = 'notes.pdf') => {
  const f = new File(['x'], name, { type: 'application/pdf' });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

describe('TC-Mat-03 list shows category metadata (CSMQP-F-012)', () => {
  test('subject, topic, type and size are displayed', async () => {
    mockFetch([{ match: /\/materials/, body: { materials: [material] } }]);
    renderWithAuth(<Materials />);
    expect(await screen.findByText('TCP handshake')).toBeInTheDocument();
    const row = screen.getByText('TCP handshake').closest('tr');
    expect(row).toHaveTextContent('Networks');
    expect(row).toHaveTextContent('Transport');
    expect(row).toHaveTextContent('PDF');
    expect(row).toHaveTextContent('2.0 MB');
  });

  test('empty result shows a friendly message', async () => {
    mockFetch([{ match: /\/materials/, body: { materials: [] } }]);
    renderWithAuth(<Materials />);
    expect(await screen.findByText('No materials found.')).toBeInTheDocument();
  });

  test('students do not see the upload form, instructors do', async () => {
    mockFetch([{ match: /\/materials/, body: { materials: [] } }]);
    const { unmount } = renderWithAuth(<Materials />, { user: users.student });
    await screen.findByText('No materials found.');
    expect(screen.queryByRole('form', { name: 'Upload material' })).not.toBeInTheDocument();
    unmount();
    renderWithAuth(<Materials />, { user: users.instructor });
    expect(await screen.findByRole('form', { name: 'Upload material' })).toBeInTheDocument();
  });
});

describe('TC-Mat-04 search and download (CSMQP-F-013)', () => {
  test('searching sends the keyword to the API', async () => {
    const fetchMock = mockFetch([{ match: /\/materials/, body: { materials: [material] } }]);
    renderWithAuth(<Materials />);
    await screen.findByText('TCP handshake');
    await userEvent.type(screen.getByLabelText('Search by name or keyword'), 'sort ing');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(fetchMock.mock.calls.at(-1)[0]).toContain('/materials?query=sort+ing'));
  });

  test('download fetches the file with the auth header and saves it under its original name', async () => {
    const fetchMock = mockFetch([{ match: /\/materials\/m1\/download/, body: {}, blob: new Blob(['pdf-bytes']) }, { match: /\/materials$/, body: { materials: [material] } }]);
    URL.createObjectURL = vi.fn(() => 'blob:fake');
    URL.revokeObjectURL = vi.fn();
    const clicked = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
      clicked.push(this.download);
    });
    renderWithAuth(<Materials />);
    await userEvent.click(await screen.findByRole('button', { name: 'Download TCP handshake' }));
    await waitFor(() => expect(clicked).toEqual(['tcp.pdf']));
    const call = fetchMock.mock.calls.find(([u]) => u.includes('/download'));
    expect(call[1].headers.Authorization).toBe('Bearer test-token');
  });

  test('a download error is shown', async () => {
    mockFetch([
      { match: /\/materials\/m1\/download/, status: 404, body: { message: 'The stored file is missing' } },
      { match: /\/materials$/, body: { materials: [material] } },
    ]);
    renderWithAuth(<Materials />);
    await userEvent.click(await screen.findByRole('button', { name: 'Download TCP handshake' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The stored file is missing');
  });
});

describe('TC-Mat-02 client-side 15 MB check (CSMQP-F-011)', () => {
  const MAX = 15 * 1024 * 1024;

  async function attempt(size) {
    const fetchMock = mockFetch([
      { match: /\/materials$/, body: { materials: [] } },
      { method: 'POST', match: /\/materials$/, status: 201, body: { material } },
    ]);
    renderWithAuth(<Materials />, { user: users.instructor });
    await screen.findByText('No materials found.');
    await userEvent.type(screen.getByLabelText('Title'), 'T');
    await userEvent.type(screen.getByLabelText('Subject'), 'S');
    await userEvent.type(screen.getByLabelText('Topic'), 'P');
    fireEvent.change(screen.getByLabelText(/^File/), { target: { files: [fileOfSize(size)] } });
    await userEvent.click(screen.getByRole('button', { name: 'Upload' }));
    return fetchMock;
  }

  test('exactly 15 MB is sent to the server', async () => {
    const fetchMock = await attempt(MAX);
    expect(await screen.findByRole('status')).toHaveTextContent('Material uploaded');
    const post = fetchMock.mock.calls.find(([, o]) => o?.method === 'POST');
    expect(post[1].body).toBeInstanceOf(FormData);
    expect(post[1].body.get('title')).toBe('T');
  });

  test('15 MB + 1 byte is rejected without a request', async () => {
    const fetchMock = await attempt(MAX + 1);
    expect(await screen.findByRole('alert')).toHaveTextContent('maximum size is 15 MB');
    expect(fetchMock.mock.calls.some(([, o]) => o?.method === 'POST')).toBe(false);
  });

  test('uploading without a file shows an error', async () => {
    mockFetch([{ match: /\/materials$/, body: { materials: [] } }]);
    renderWithAuth(<Materials />, { user: users.instructor });
    await screen.findByText('No materials found.');
    await userEvent.type(screen.getByLabelText('Title'), 'T');
    await userEvent.type(screen.getByLabelText('Subject'), 'S');
    await userEvent.type(screen.getByLabelText('Topic'), 'P');
    await userEvent.click(screen.getByRole('button', { name: 'Upload' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a file');
  });

  test('server rejection (unsupported type) is displayed', async () => {
    mockFetch([
      { match: /\/materials$/, body: { materials: [] } },
      { method: 'POST', match: /\/materials$/, status: 400, body: { message: 'Unsupported file type. Allowed formats: PDF, DOCX, PPTX, JPG' } },
    ]);
    renderWithAuth(<Materials />, { user: users.instructor });
    await screen.findByText('No materials found.');
    await userEvent.type(screen.getByLabelText('Title'), 'T');
    await userEvent.type(screen.getByLabelText('Subject'), 'S');
    await userEvent.type(screen.getByLabelText('Topic'), 'P');
    fireEvent.change(screen.getByLabelText(/^File/), { target: { files: [fileOfSize(10, 'virus.exe')] } });
    await userEvent.click(screen.getByRole('button', { name: 'Upload' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unsupported file type');
  });
});

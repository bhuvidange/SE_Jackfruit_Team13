import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReportButton from './ReportButton';
import { mockFetch, sentBody } from '../test/mockFetch';
import { renderWithAuth } from '../test/renderWithAuth';

const openForm = () => userEvent.click(screen.getByRole('button', { name: 'Report this material' }));

describe('TC-Admin-08 ReportButton (CSMQP-F-051)', () => {
  test('opens a reason form, posts the report and thanks the user', async () => {
    const fetchMock = mockFetch([{ method: 'POST', match: /\/reports$/, status: 201, body: { report: { id: 'r1' } } }]);
    renderWithAuth(<ReportButton targetType="material" targetId="m1" />);
    expect(screen.queryByLabelText('Why are you reporting this?')).not.toBeInTheDocument();

    await openForm();
    await userEvent.type(screen.getByLabelText('Why are you reporting this?'), '  Spam  ');
    await userEvent.click(screen.getByRole('button', { name: 'Send report' }));

    expect(await screen.findByText('Reported - thank you')).toBeInTheDocument();
    expect(sentBody(fetchMock.mock.calls[0])).toEqual({ targetType: 'material', targetId: 'm1', reason: 'Spam' });
    expect(screen.queryByRole('button', { name: /Report this/ })).not.toBeInTheDocument();
  });

  test('a blank reason is not sent', async () => {
    const fetchMock = mockFetch([]);
    renderWithAuth(<ReportButton targetType="material" targetId="m1" />);
    await openForm();
    await userEvent.type(screen.getByLabelText('Why are you reporting this?'), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Please tell us why');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('shows the server error and lets the user try again', async () => {
    mockFetch([{ method: 'POST', match: /\/reports$/, status: 409, body: { message: 'You have already reported this item' } }]);
    renderWithAuth(<ReportButton targetType="question" targetId="q1" />);
    await userEvent.click(screen.getByRole('button', { name: 'Report this question' }));
    await userEvent.type(screen.getByLabelText('Why are you reporting this?'), 'Wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already reported');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send report' })).toBeEnabled());
    expect(screen.queryByText('Reported - thank you')).not.toBeInTheDocument();
  });

  test('Cancel closes the form without sending anything', async () => {
    const fetchMock = mockFetch([]);
    renderWithAuth(<ReportButton targetType="material" targetId="m1" />);
    await openForm();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Report this material' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

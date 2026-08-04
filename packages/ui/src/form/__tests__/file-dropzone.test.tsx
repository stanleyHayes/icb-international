import '@testing-library/jest-dom/vitest';
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FileDropzone } from '../file-dropzone';

function makeFile(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type });
}

afterEach(cleanup);

describe('FileDropzone', () => {
  it('renders a focusable drop zone with the hint copy', () => {
    render(<FileDropzone value={[]} onChange={() => undefined} />);
    const zone = screen.getByRole('button');
    expect(zone).toHaveTextContent(/drag and drop/i);
    expect(zone).toHaveAttribute('tabindex', '0');
  });

  it('accepts dropped files and lists them with sizes', () => {
    const onChange = vi.fn();
    render(<FileDropzone value={[]} onChange={onChange} />);
    fireEvent.drop(screen.getByRole('button'), {
      dataTransfer: { files: [makeFile('passport.pdf', 'application/pdf', 2048)] },
    });
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ name: 'passport.pdf' })]);
  });

  it('rejects files failing the rules with reasons', () => {
    const onReject = vi.fn();
    render(
      <FileDropzone value={[]} onChange={() => undefined} onReject={onReject} accept=".pdf" maxSizeBytes={100} />,
    );
    fireEvent.drop(screen.getByRole('button'), {
      dataTransfer: {
        files: [makeFile('photo.png', 'image/png', 10), makeFile('big.pdf', 'application/pdf', 5000)],
      },
    });
    expect(onReject).toHaveBeenCalledWith([
      { name: 'photo.png', reason: 'type' },
      { name: 'big.pdf', reason: 'size' },
    ]);
  });

  it('caps the list at maxFiles', () => {
    const onChange = vi.fn();
    const existing = [makeFile('a.pdf', 'application/pdf', 1)];
    render(<FileDropzone value={existing} onChange={onChange} maxFiles={2} />);
    fireEvent.drop(screen.getByRole('button', { name: /drag and drop/i }), {
      dataTransfer: { files: [makeFile('b.pdf', 'application/pdf', 1), makeFile('c.pdf', 'application/pdf', 1)] },
    });
    expect(onChange.mock.calls[0]?.[0]).toHaveLength(2);
  });

  it('removes a file from the list', async () => {
    const onChange = vi.fn();
    const file = makeFile('statement.pdf', 'application/pdf', 1024);
    render(<FileDropzone value={[file]} onChange={onChange} />);
    expect(screen.getByText('statement.pdf')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove statement.pdf' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('does not open the picker when disabled', () => {
    render(<FileDropzone value={[]} onChange={() => undefined} disabled />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button')).toHaveAttribute('tabindex', '-1');
  });
});

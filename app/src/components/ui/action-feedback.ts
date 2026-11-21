import Swal from 'sweetalert2';
export async function confirmAction(title: string, text?: string, confirmButtonText = 'Confirm') {
  const r = await Swal.fire({
    title,
    text,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText,
    confirmButtonColor: '#242625',
    background: '#f6f3ed',
    color: '#202221',
  });
  return r.isConfirmed;
}
export async function success(title: string) {
  await Swal.fire({
    title,
    icon: 'success',
    timer: 1300,
    showConfirmButton: false,
    background: '#f6f3ed',
  });
}
export async function failure(message: string, title = 'Something went wrong') {
  await Swal.fire({
    title,
    text: message,
    icon: 'warning',
    confirmButtonColor: '#242625',
    background: '#f6f3ed',
  });
}

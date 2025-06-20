document.addEventListener("DOMContentLoaded", function () {
  $("select").selectize({
    create: false,
    sortField: "text",
  });
});

function toggleEditMode(button) {
        const row = button.closest('tr');
        row.querySelectorAll('.view-mode').forEach(el => el.style.display = 'none');
        row.querySelectorAll('.edit-mode').forEach(el => el.style.display = 'block');
        row.querySelector('.btn-edit').style.display = 'none';
        row.querySelector('.btn-save').style.display = 'inline-block';
        row.querySelector('.btn-cancel').style.display = 'inline-block';
    }

    function cancelEdit(button) {
        const row = button.closest('tr');
        row.querySelectorAll('.view-mode').forEach(el => el.style.display = 'inline');
        row.querySelectorAll('.edit-mode').forEach(el => el.style.display = 'none');
        row.querySelector('.btn-edit').style.display = 'inline-block';
        row.querySelector('.btn-save').style.display = 'none';
        row.querySelector('.btn-cancel').style.display = 'none';
    }

    async function saveUser(button) {
    const row = button.closest('tr');
    const userId = row.dataset.userId;
    const username = row.querySelector('td:nth-child(1) .edit-mode').value;
    const email = row.querySelector('td:nth-child(2) .edit-mode').value;
    const company = row.querySelector('td:nth-child(3) .edit-mode').value;

    try {
        const response = await fetch(`/api/client-admin/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': '{{ csrf_token() }}',
                'Authorization': `Bearer ${getCookie('access_token_cookie')}`
            },
            body: JSON.stringify({
                username: username,
                email: email,
                company: company
            })
        });

        if (response.ok) {
            location.reload();
        } else {
            const error = await response.json();
            alert(`Error: ${error.error || 'Failed to update user'}`);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error updating user');
    }
}

async function deleteUser(userId) {
    if (confirm('Are you sure you want to delete this user?')) {
        try {
            const response = await fetch(`/api/client-admin/${userId}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRFToken': '{{ csrf_token() }}',
                    'Authorization': `Bearer ${getCookie('access_token_cookie')}`
                }
            });

            if (response.ok) {
                location.reload();
            } else {
                const error = await response.json();
                alert(`Error: ${error.error || 'Failed to delete user'}`);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error deleting user');
        }
    }
}

// Helper function to get cookies
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}
using UnityEngine;

[RequireComponent(typeof(CharacterController))]
public class PlayerController : MonoBehaviour
{
    public float speed = 5.0f;
    public float sensitivity = 2.0f;
    public Camera playerCamera;

    private CharacterController controller;
    private float rotationX = 0;

    void Start()
    {
        controller = GetComponent<CharacterController>();
        Cursor.lockState = CursorLockMode.Locked;
        Cursor.visible = false;
    }

    void Update()
    {
        // Movement logic
        float moveForward = Input.GetAxis("Vertical");
        float moveSides = Input.GetAxis("Horizontal");

        Vector3 move = transform.right * moveSides + transform.forward * moveForward;
        controller.Move(move * speed * Time.deltaTime);

        // Rotation logic
        float mouseX = Input.GetAxis("Mouse X") * sensitivity;
        float mouseY = Input.GetAxis("Mouse Y") * sensitivity;

        rotationX -= mouseY;
        rotationX = Mathf.Clamp(rotationX, -90f, 90f);

        playerCamera.transform.localRotation = Quaternion.Euler(rotationX, 0, 0);
        transform.Rotate(Vector3.up * mouseX);
    }
}

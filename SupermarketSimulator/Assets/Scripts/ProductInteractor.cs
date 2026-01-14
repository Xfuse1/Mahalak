using UnityEngine;

public class ProductInteractor : MonoBehaviour
{
    public float interactDistance = 3f;
    public LayerMask interactableLayer;
    public Camera playerCamera;
    public Transform dropPoint; // Point in front of player where item spawns
    public GameObject physicalProductPrefab; // Base prefab for products

    private void Update()
    {
        Ray ray = playerCamera.ViewportPointToRay(new Vector3(0.5f, 0.5f, 0));
        RaycastHit hit;

        if (Physics.Raycast(ray, out hit, interactDistance, interactableLayer))
        {
            PickupProduct product = hit.collider.GetComponent<PickupProduct>();
            if (product != null)
            {
                UIManager.Instance.ShowPrompt($"Press E to take {product.productData.name}");

                if (Input.GetKeyDown(KeyCode.E))
                {
                    SpawnPhysicalItem(product.productData);
                    SoundManager.Instance.PlayGrab();
                }
            }
        }
        else
        {
            UIManager.Instance.ShowPrompt("");
        }
    }

    void SpawnPhysicalItem(Product data)
    {
        GameObject item = Instantiate(physicalProductPrefab, dropPoint.position, dropPoint.rotation);
        
        // Setup the physical object
        PhysicalCartProduct phys = item.AddComponent<PhysicalCartProduct>();
        phys.productData = data;
        
        // Add physics
        Rigidbody rb = item.GetComponent<Rigidbody>();
        if (rb == null) rb = item.AddComponent<Rigidbody>();
        
        // Give it a tiny push forward
        rb.AddForce(playerCamera.transform.forward * 2f, ForceMode.Impulse);
    }
}

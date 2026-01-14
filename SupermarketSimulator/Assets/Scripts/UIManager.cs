using UnityEngine;
using UnityEngine.UI;
using TMPro; // Highly recommended for clean UI

public class UIManager : MonoBehaviour
{
    public static UIManager Instance;

    [Header("Cart UI")]
    public GameObject cartPanel;
    public Transform itemListParent;
    public GameObject itemPrefab;
    public TextMeshProUGUI totalPriceText;

    [Header("Gamification UI")]
    public TextMeshProUGUI pointsText;
    public TextMeshProUGUI timerText;
    public TextMeshProUGUI discountText;

    private void Awake()
    {
        if (Instance == null) Instance = this;
    }

    private void Start()
    {
        cartPanel.SetActive(false);
        promptText.text = "";
    }

    private void Update()
    {
        if (Input.GetKeyDown(KeyCode.Tab))
        {
            ToggleCart();
        }
    }

    public void ToggleCart()
    {
        cartPanel.SetActive(!cartPanel.activeSelf);
        // Unlock cursor when cart is open
        Cursor.lockState = cartPanel.activeSelf ? CursorLockMode.None : CursorLockMode.Locked;
        Cursor.visible = cartPanel.activeSelf;
    }

    public void UpdateCartUI()
    {
        // Clear existing list
        foreach (Transform child in itemListParent)
        {
            Destroy(child.gameObject);
        }

        // Populate list
        foreach (var item in CartManager.Instance.items)
        {
            GameObject entry = Instantiate(itemPrefab, itemListParent);
            entry.GetComponentInChildren<TextMeshProUGUI>().text = $"{item.name} - ${item.price}";
        }

        totalPriceText.text = $"Total: ${CartManager.Instance.TotalPrice:F2}";
    }

    public void ShowPrompt(string message)
    {
        promptText.text = message;
    }

    public void UpdatePointsUI(int points)
    {
        pointsText.text = $"Healthy Points: {points}";
    }

    public void UpdateTimerUI(float time)
    {
        int minutes = Mathf.FloorToInt(time / 60);
        int seconds = Mathf.FloorToInt(time % 60);
        timerText.text = string.Format("{0:00}:{1:00}", minutes, seconds);
    }

    public void OnCheckoutButtonClicked()
    {
        GamificationManager.Instance.CalculateDiscount();
        float finalPrice = GamificationManager.Instance.GetFinalPrice(CartManager.Instance.TotalPrice);
        discountText.text = GamificationManager.Instance.discountPercent > 0 ? "5% speed discount applied!" : "";
        totalPriceText.text = $"Total: ${finalPrice:F2}";
        
        FindObjectOfType<APIHandler>().Checkout(CartManager.Instance.GetCartData());
    }
}

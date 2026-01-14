using UnityEngine;
using TMPro;

public class GamificationManager : MonoBehaviour
{
    public static GamificationManager Instance;

    [Header("Healthy Points")]
    public int healthyPoints = 0;
    
    [Header("Timer Settings")]
    public float timeRemaining = 120f; // 2 minutes
    public bool timerIsRunning = false;
    public float discountPercent = 0f;

    private void Awake()
    {
        if (Instance == null) Instance = this;
    }

    private void Start()
    {
        timerIsRunning = true;
    }

    private void Update()
    {
        if (timerIsRunning)
        {
            if (timeRemaining > 0)
            {
                timeRemaining -= Time.deltaTime;
                UIManager.Instance.UpdateTimerUI(timeRemaining);
            }
            else
            {
                timeRemaining = 0;
                timerIsRunning = false;
                Debug.Log("Time's up! No discount.");
            }
        }
    }

    public void AddHealthyPoints(int points)
    {
        healthyPoints += points;
        UIManager.Instance.UpdatePointsUI(healthyPoints);
    }

    public void CalculateDiscount()
    {
        if (timeRemaining > 0)
        {
            discountPercent = 0.05f; // 5% discount
            Debug.Log("Speed checkout! 5% discount applied.");
        }
    }

    public float GetFinalPrice(float total)
    {
        return total * (1 - discountPercent);
    }
}

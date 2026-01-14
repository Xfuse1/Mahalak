using UnityEngine;
using System.Collections.Generic;

public class ShelfPopulator : MonoBehaviour
{
    public List<PickupProduct> shelfSlots; // Assign these in Inspector

    public void PopulateShelves(List<Product> products)
    {
        for (int i = 0; i < shelfSlots.Count && i < products.Count; i++)
        {
            shelfSlots[i].Initialize(products[i]);
            // You can also change the mesh based on products[i].modelType
        }
    }
}
